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
}

interface AnalysisRow {
  id: string;
  scenario_input: { scenario?: string } | null;
  result: (AnalysisResult & { retrievedChunks?: LawChunk[] }) | null;
  model_id: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse<ShareViewResponse>> {
  const token = params.token?.trim();
  if (!token) {
    return jsonError(400, "Missing share token.", "VALIDATION");
  }

  const supabase = getServerClient();

  const shareLookup = await supabase
    .from("shared_analyses")
    .select("id, share_token, analysis_id, view_count, created_at")
    .eq("share_token", token)
    .maybeSingle<SharedAnalysisRow>();

  if (shareLookup.error || !shareLookup.data) {
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

  // Increment view count (best-effort).
  const newCount = (shareLookup.data.view_count ?? 0) + 1;
  void supabase
    .from("shared_analyses")
    .update({ view_count: newCount })
    .eq("id", shareLookup.data.id);

  // Fire-and-forget analytics. Use the viewer's session id if we have one.
  const viewerSession = (await readSessionId()) ?? "anonymous";
  trackEvent({
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
    viewCount: newCount,
    createdAt: shareLookup.data.created_at,
  });
}
