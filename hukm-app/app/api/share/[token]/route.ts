/**
 * GET /api/share/[token]
 *
 * Returns a public, read-only view of a shared analysis. No session
 * required; anyone with the token can view. We atomically increment
 * `view_count` so the share page can show how many times it's been
 * read.
 */

import { NextResponse, type NextRequest } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isAnalysisOwner } from "@/lib/ownership";
import { checkEndpointRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { AnalysisResult, LawChunk, ShareViewResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SharedAnalysisRow {
  id: string;
  share_token: string;
  analysis_id: string;
  view_count: number;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
}

interface AnalysisRow {
  id: string;
  scenario_input: { scenario?: string } | null;
  result: (AnalysisResult & { retrievedChunks?: LawChunk[] }) | null;
  model_id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse<ShareViewResponse>> {
  const token = params.token?.trim();
  if (!token) {
    return jsonError(400, "Missing share token.", "VALIDATION");
  }

  // Rate-limit by IP — share views are public, but we don't want an
  // attacker enumerating tokens or inflating view counts. 60/min/IP
  // is generous for legitimate sharing.
  const rateLimit = await checkEndpointRateLimit(request, {
    endpoint: "share-view",
    max: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return jsonError(
      429,
      `Rate limit exceeded. Retry after ${rateLimit.retryAfterSeconds} seconds.`,
      "RATE_LIMIT",
      rateLimitHeaders(rateLimit),
    ) as NextResponse<ShareViewResponse>;
  }

  const supabase = getServerClient();

  const shareLookup = await supabase
    .from("shared_analyses")
    .select("id, share_token, analysis_id, view_count, created_at, revoked_at, expires_at")
    .eq("share_token", token)
    .maybeSingle<SharedAnalysisRow>();

  if (shareLookup.error || !shareLookup.data) {
    return jsonError(404, "Share link not found.", "NOT_FOUND");
  }

  // Revoked or expired links are indistinguishable from never-existing
  // ones — no information leak about the token's history.
  const { revoked_at: revokedAt, expires_at: expiresAt } = shareLookup.data;
  if (revokedAt || (expiresAt && new Date(expiresAt).getTime() <= Date.now())) {
    return jsonError(404, "Share link not found.", "NOT_FOUND");
  }

  const analysisLookup = await supabase
    .from("analysis_results")
    .select("id, scenario_input, result, model_id")
    .eq("id", shareLookup.data.analysis_id)
    .maybeSingle<AnalysisRow>();

  if (analysisLookup.error || !analysisLookup.data?.result) {
    logger.error("[share/get] analysis fetch failed", {
      token,
      error: analysisLookup.error?.message,
    });
    return jsonError(404, "Shared analysis not available.", "NOT_FOUND");
  }

  // Increment view count atomically via a Postgres RPC.
  // The previous code did `newCount = view_count + 1; update(view_count=newCount)`
  // which is a classic read-then-write race — concurrent viewers all read
  // the same count, compute +1, and overwrite, causing undercounting.
  // The RPC does `UPDATE ... SET view_count = view_count + 1 RETURNING
  // view_count` in a single atomic statement.
  let viewCount = (shareLookup.data.view_count ?? 0) + 1;
  try {
    const { data: newCount, error: incError } = await supabase.rpc(
      "increment_share_view_count",
      { p_token: token },
    );
    if (!incError && typeof newCount === "number") {
      viewCount = newCount;
    } else if (incError) {
      // RPC not defined yet (migration not applied) — fall back to the
      // old non-atomic update. Best-effort; logs the warning.
      logger.warn("[share/get] increment RPC failed, falling back to non-atomic update", {
        message: incError.message,
        code: incError.code,
      });
      void supabase
        .from("shared_analyses")
        .update({ view_count: viewCount })
        .eq("id", shareLookup.data.id);
    }
  } catch (err) {
    logger.warn("[share/get] increment RPC threw", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Fire-and-forget analytics. Use the viewer's session id if we have one.
  const viewerSession = (await readSessionId()) ?? "anonymous";
  await trackEvent({
    eventType: "share_viewed",
    sessionId: viewerSession,
    metadata: { token, analysisId: shareLookup.data.analysis_id },
  });

  const { retrievedChunks: _omit, ...result } = analysisLookup.data.result;
  void _omit;
  const retrievedChunks = analysisLookup.data.result.retrievedChunks ?? [];
  const scenario =
    (typeof analysisLookup.data.scenario_input?.scenario === "string"
      ? analysisLookup.data.scenario_input.scenario
      : "(scenario not recorded)") ?? "(scenario not recorded)";

  return NextResponse.json({
    success: true,
    token,
    result: result as AnalysisResult,
    retrievedChunks,
    modelId: analysisLookup.data.model_id,
    scenario,
    viewCount,
    createdAt: shareLookup.data.created_at,
  });
}

/**
 * DELETE /api/share/[token]
 *
 * Owner-gated revocation ("Disable link"). Requires the caller's session
 * to match BOTH the share row's creator AND the underlying analysis
 * owner. Revoked links 404 from then on; the operation is permanent.
 * Returns 404 for unknown tokens / non-owners — no enumeration oracle.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse> {
  const token = params.token?.trim();
  if (!token) {
    return jsonError(400, "Missing share token.", "VALIDATION");
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(404, "Share link not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();

  const shareLookup = await supabase
    .from("shared_analyses")
    .select("id, analysis_id, created_by_session")
    .eq("share_token", token)
    .maybeSingle<{ id: string; analysis_id: string; created_by_session: string }>();

  if (shareLookup.error || !shareLookup.data) {
    return jsonError(404, "Share link not found.", "NOT_FOUND");
  }

  if (shareLookup.data.created_by_session !== sessionId) {
    return jsonError(404, "Share link not found.", "NOT_FOUND");
  }

  const ownsAnalysis = await isAnalysisOwner(shareLookup.data.analysis_id, sessionId);
  if (!ownsAnalysis) {
    return jsonError(404, "Share link not found.", "NOT_FOUND");
  }

  const { error } = await supabase
    .from("shared_analyses")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareLookup.data.id);

  if (error) {
    logger.error("[share/revoke] failed", {
      error: error.message,
      code: error.code,
    });
    return jsonError(500, "Could not disable the share link.", "PERSIST_FAILED");
  }

  await trackEvent({
    eventType: "share_revoked",
    sessionId,
    metadata: { token, analysisId: shareLookup.data.analysis_id },
  });

  return NextResponse.json({ success: true });
}
