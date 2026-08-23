/**
 * POST /api/share
 *
 * Creates a publicly-readable share link for an analysis the caller owns.
 * The token is a 12-char nanoid. Idempotency: if the analysis already has
 * a share row from the same session, we return the existing token rather
 * than minting a duplicate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";

import { trackEvent } from "@/lib/analytics";
import { describeDbError, isMigrationPending } from "@/lib/dbErrors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isAnalysisOwner } from "@/lib/ownership";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { CreateShareResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExistingShareRow {
  share_token: string;
  revoked_at: string | null;
  expires_at: string | null;
}

/** True when a share row is still viewable (not revoked, not expired). */
function isShareLive(row: { revoked_at: string | null; expires_at: string | null }): boolean {
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

function publicAppUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.replace(/\/$/, "");
  // Derive from the incoming request as a fallback.
  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateShareResponse>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  const body = raw as { analysisId?: unknown };
  if (typeof body.analysisId !== "string" || body.analysisId.trim().length === 0) {
    return jsonError(400, "`analysisId` is required.", "VALIDATION");
  }
  const analysisId = body.analysisId.trim();

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const owns = await isAnalysisOwner(analysisId, sessionId);
  if (!owns) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();

  // Reuse an existing LIVE share token from this session if present.
  // Revoked/expired links are never reused — a fresh token is minted so
  // "share again" always produces a working link.
  const existing = await supabase
    .from("shared_analyses")
    .select("share_token, revoked_at, expires_at")
    .eq("analysis_id", analysisId)
    .eq("created_by_session", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ExistingShareRow>();

  if (existing.error && isMigrationPending(existing.error)) {
    const described = describeDbError(
      existing.error,
      "Could not create the share link.",
      "PERSIST_FAILED",
    );
    return jsonError(described.status, described.error, described.code);
  }

  let token = existing.data && isShareLive(existing.data) ? existing.data.share_token : undefined;
  if (!token) {
    token = nanoid(12);
    const { error } = await supabase.from("shared_analyses").insert({
      share_token: token,
      analysis_id: analysisId,
      created_by_session: sessionId,
    });
    if (error) {
      logger.error("[share] failed to insert", {
        error: error.message,
        code: error.code,
      });
      const described = describeDbError(
        error,
        "Could not create the share link.",
        "PERSIST_FAILED",
      );
      return jsonError(described.status, described.error, described.code);
    }
    await trackEvent({
      eventType: "share_created",
      sessionId,
      metadata: { analysisId },
    });
  }

  const baseUrl = publicAppUrl(request);
  return NextResponse.json({
    success: true,
    shareUrl: baseUrl ? `${baseUrl}/share/${token}` : `/share/${token}`,
    token,
  });
}
