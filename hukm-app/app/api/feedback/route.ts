/**
 * POST /api/feedback
 *
 * Records the caller's thumbs-up / thumbs-down rating for a specific
 * analysis. Enforced UNIQUE(analysis_id, session_id) at the database
 * level; we also surface a friendly error if a rating already exists.
 */

import { NextResponse, type NextRequest } from "next/server";

import { trackEvent } from "@/lib/analytics";
import { describeDbError } from "@/lib/dbErrors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isAnalysisOwner } from "@/lib/ownership";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type {
  FeedbackRating,
  FeedbackSubmitResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMENT_MAX = 500;

interface ValidatedFeedback {
  analysisId: string;
  rating: FeedbackRating;
  comment?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(raw: unknown): ValidatedFeedback | string {
  if (!isObject(raw)) return "Request body must be a JSON object.";

  const analysisId = raw.analysisId;
  if (typeof analysisId !== "string" || analysisId.trim().length === 0) {
    return "`analysisId` is required.";
  }

  const rating = raw.rating;
  if (rating !== 1 && rating !== -1) {
    return "`rating` must be 1 or -1.";
  }

  let comment: string | undefined;
  if (raw.comment !== undefined && raw.comment !== null) {
    if (typeof raw.comment !== "string") return "`comment` must be a string.";
    if (raw.comment.length > COMMENT_MAX) {
      return `\`comment\` must not exceed ${COMMENT_MAX} characters.`;
    }
    const trimmed = raw.comment.trim();
    if (trimmed.length > 0) comment = trimmed;
  }

  return { analysisId: analysisId.trim(), rating, comment };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<FeedbackSubmitResponse>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  const validated = validate(raw);
  if (typeof validated === "string") {
    return jsonError(400, validated, "VALIDATION");
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(403, "No active session.", "SESSION_MISMATCH");
  }

  const owns = await isAnalysisOwner(validated.analysisId, sessionId);
  if (!owns) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();
  const { error } = await supabase.from("feedback").insert({
    analysis_id: validated.analysisId,
    session_id: sessionId,
    rating: validated.rating,
    comment: validated.comment ?? null,
  });

  if (error) {
    // 23505 = unique_violation in Postgres.
    if (error.code === "23505") {
      return jsonError(
        409,
        "You've already given feedback on this analysis.",
        "FEEDBACK_DUPLICATE",
      );
    }
    logger.error("[feedback] insert failed", {
      error: error.message,
      code: error.code,
    });
    const described = describeDbError(
      error,
      "Could not save feedback.",
      "PERSIST_FAILED",
    );
    return jsonError(described.status, described.error, described.code);
  }

  trackEvent({
    eventType: "feedback_submitted",
    sessionId,
    metadata: {
      analysisId: validated.analysisId,
      rating: validated.rating,
      hasComment: validated.comment !== undefined,
    },
  });

  // Reference the request object so the unused-args lint rule is satisfied.
  void request;
  return NextResponse.json({ success: true });
}
