/**
 * POST /api/conversations
 *   Creates a conversation tied to the caller's session id.
 *   Optionally seeds the new conversation from a previous analysis.
 *
 * GET /api/conversations
 *   Returns recent conversations for the caller's session.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isValidModelId } from "@/lib/models";
import { isAnalysisOwner } from "@/lib/ownership";
import { getOrCreateSessionId, readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type {
  ConfidenceLevel,
  CreateConversationResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST: create
// ---------------------------------------------------------------------------

interface ValidatedCreateBody {
  scenarioDescription: string;
  modelId: string;
  analysisId?: string;
}

function validateCreate(raw: unknown): ValidatedCreateBody | string {
  if (!raw || typeof raw !== "object") {
    return "Request body must be a JSON object.";
  }
  const body = raw as Record<string, unknown>;

  const scenarioDescription = body.scenarioDescription;
  if (
    typeof scenarioDescription !== "string" ||
    scenarioDescription.trim().length === 0
  ) {
    return "`scenarioDescription` is required.";
  }
  if (scenarioDescription.length > 5000) {
    return "`scenarioDescription` must not exceed 5000 characters.";
  }

  const modelId = body.modelId;
  if (typeof modelId !== "string" || modelId.trim().length === 0) {
    return "`modelId` is required.";
  }
  if (!isValidModelId(modelId)) {
    return "`modelId` is not registered.";
  }

  let analysisId: string | undefined;
  if (body.analysisId !== undefined) {
    if (
      typeof body.analysisId !== "string" ||
      body.analysisId.trim().length === 0
    ) {
      return "`analysisId` must be a non-empty string when provided.";
    }
    analysisId = body.analysisId.trim();
  }

  return { scenarioDescription: scenarioDescription.trim(), modelId, analysisId };
}

interface AnalysisResultRow {
  result: {
    confidenceLevel?: ConfidenceLevel;
    isCivilMatter?: boolean;
    needsClarification?: boolean;
  } | null;
  scenario_input: { scenario?: string } | null;
  model_id: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateConversationResponse>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  const validated = validateCreate(raw);
  if (typeof validated === "string") {
    return jsonError(400, validated, "VALIDATION");
  }
  const { scenarioDescription, modelId, analysisId } = validated;

  const sessionId = await getOrCreateSessionId();
  if (!sessionId) {
    return jsonError(401, "You must be signed in to start a conversation.", "UNAUTHENTICATED");
  }
  const supabase = getServerClient();

  // If seeded from an analysis, verify ownership and copy summary fields.
  let confidenceLevel: ConfidenceLevel | null = null;
  let isCivilMatter = false;
  let needsClarification = false;

  if (analysisId) {
    const owns = await isAnalysisOwner(analysisId, sessionId);
    if (!owns) {
      return jsonError(
        404,
        "Analysis not found, or you don't have access to it.",
        "ANALYSIS_NOT_FOUND",
      );
    }
    const analysisLookup = await supabase
      .from("analysis_results")
      .select("result, scenario_input, model_id")
      .eq("id", analysisId)
      .maybeSingle<AnalysisResultRow>();
    if (analysisLookup.data?.result) {
      confidenceLevel = analysisLookup.data.result.confidenceLevel ?? null;
      isCivilMatter = Boolean(analysisLookup.data.result.isCivilMatter);
      needsClarification = Boolean(
        analysisLookup.data.result.needsClarification,
      );
    }
  }

  const insertResult = await supabase
    .from("conversations")
    .insert({
      session_id: sessionId,
      scenario_description: scenarioDescription,
      model_id: modelId,
      confidence_level: confidenceLevel,
      is_civil_matter: isCivilMatter,
      needs_clarification: needsClarification,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data?.id) {
    logger.error("[conversations] insert failed", {
      error: insertResult.error?.message,
      code: insertResult.error?.code,
    });
    return jsonError(
      500,
      "Could not create the conversation. Please try again.",
      "PERSIST_FAILED",
    );
  }

  const conversationId = insertResult.data.id as string;

  // Seed with a system message that gives the chat model a starting
  // point even if no previous analysis was available.
  const seedInsert = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "system",
      content: `Conversation started for scenario: ${scenarioDescription}`,
      metadata: analysisId ? { analysisId } : null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (seedInsert.error || !seedInsert.data?.id) {
    // The conversation row was created but the seed message failed.
    // Log it so we can investigate, but DON'T fail the request — the
    // conversation is still usable, just missing its bootstrap system
    // message. The previous code silently swallowed this error.
    logger.error("[conversations] seed system message insert failed", {
      conversationId,
      error: seedInsert.error?.message,
      code: seedInsert.error?.code,
    });
  }

  logger.info("[conversations] created", { conversationId, hasAnalysis: !!analysisId });

  return NextResponse.json({ success: true, conversationId });
}

// ---------------------------------------------------------------------------
// GET: list
// ---------------------------------------------------------------------------

interface ConversationListRow {
  id: string;
  scenario_description: string | null;
  first_user_message: string | null;
  model_id: string;
  confidence_level: ConfidenceLevel | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export async function GET(): Promise<NextResponse> {
  const sessionId = await readSessionId();
  if (!sessionId) {
    return NextResponse.json({ success: true, conversations: [] });
  }

  const supabase = getServerClient();
  const { data, error } = await supabase.rpc("get_recent_conversations", {
    p_session_id: sessionId,
    p_limit: 20,
  });

  if (error) {
    logger.error("[conversations] list failed", {
      error: error.message,
      code: error.code,
    });
    return jsonError(
      500,
      "Could not load conversations.",
      "DB_READ",
    );
  }

  const rows = (data as ConversationListRow[] | null) ?? [];
  return NextResponse.json({ success: true, conversations: rows });
}
