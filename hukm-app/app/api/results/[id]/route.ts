/**
 * GET /api/results/[id]
 *
 * Returns a persisted analysis result if it belongs to the caller's
 * session. Used by the /results/[id] page to hydrate after refresh.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isAnalysisOwner } from "@/lib/ownership";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { AnalysisResult, LawChunk } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalysisRow {
  id: string;
  scenario_input: {
    scenario?: string;
    modelId?: string;
    language?: string;
  } | null;
  result: (AnalysisResult & { retrievedChunks?: LawChunk[] }) | null;
  model_id: string;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const id = params.id?.trim();
  if (!id) {
    return jsonError(400, "Missing analysis id.", "VALIDATION");
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const owns = await isAnalysisOwner(id, sessionId);
  if (!owns) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("analysis_results")
    .select("id, scenario_input, result, model_id, created_at")
    .eq("id", id)
    .maybeSingle<AnalysisRow>();

  if (error) {
    logger.error("[results] fetch failed", {
      id,
      error: error.message,
    });
    return jsonError(500, "Could not load the analysis.", "DB_READ");
  }
  if (!data || !data.result) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const { retrievedChunks: _ignored, ...result } = data.result;
  void _ignored;

  return NextResponse.json({
    success: true,
    id: data.id,
    scenarioInput: data.scenario_input,
    result: result as AnalysisResult,
    retrievedChunks: data.result.retrievedChunks ?? [],
    modelId: data.model_id,
    createdAt: data.created_at,
  });
}
