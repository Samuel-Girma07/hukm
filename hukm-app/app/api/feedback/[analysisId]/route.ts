/**
 * GET /api/feedback/[analysisId]
 *
 * Returns whether the caller has already submitted feedback on this
 * analysis (so the FeedbackWidget can skip directly to the "submitted"
 * state).
 */

import { NextResponse, type NextRequest } from "next/server";

import { isMigrationPending } from "@/lib/dbErrors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type {
  FeedbackRating,
  FeedbackStatusResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FeedbackRow {
  rating: FeedbackRating;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { analysisId: string } },
): Promise<NextResponse<FeedbackStatusResponse>> {
  const analysisId = params.analysisId?.trim();
  if (!analysisId) {
    return jsonError(400, "Missing analysis id.", "VALIDATION");
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return NextResponse.json({ success: true, submitted: false, rating: null });
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("rating")
    .eq("analysis_id", analysisId)
    .eq("session_id", sessionId)
    .maybeSingle<FeedbackRow>();

  if (error) {
    if (isMigrationPending(error)) {
      // Feedback table not migrated yet — pretend no feedback exists
      // so the widget renders normally instead of showing an error.
      return NextResponse.json({
        success: true,
        submitted: false,
        rating: null,
      });
    }
    logger.error("[feedback] status lookup failed", {
      analysisId,
      error: error.message,
    });
    return jsonError(500, "Could not load feedback status.", "DB_READ");
  }

  return NextResponse.json({
    success: true,
    submitted: !!data,
    rating: data?.rating ?? null,
  });
}
