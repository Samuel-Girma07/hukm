/**
 * /api/conversations
 *
 * GET: lists recent conversations for the calling session.
 * POST: creates a new conversation (called by the results page when the
 *       user clicks "Continue Conversation"). Optionally seeds the first
 *       assistant + user messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import {
  assertOwnsAnalysisResult,
  OwnershipError,
} from "@/lib/ownership";
import { logger } from "@/lib/logger";
import { isValidModelId } from "@/lib/models";

export async function GET() {
  try {
    const sessionId = await getSessionId();
    const supabase = getServerClient();

    const { data, error } = await supabase.rpc("get_recent_conversations", {
      p_session_id: sessionId,
      p_limit: 50,
    });

    if (error) {
      logger.error("get_recent_conversations failed:", error);
      return NextResponse.json(
        { success: false, error: "Failed to load conversations" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    logger.error("GET /api/conversations failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

interface CreateConversationBody {
  resultId?: string;
  modelId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateConversationBody;

    const sessionId = await getSessionId();
    const supabase = getServerClient();

    // Path 1: created from a saved analysis result
    if (body.resultId) {
      await assertOwnsAnalysisResult(supabase, body.resultId, sessionId);

      const { data: resultRow, error: resultError } = await supabase
        .from("analysis_results")
        .select("scenario_input, result, model_id")
        .eq("id", body.resultId)
        .single();

      if (resultError || !resultRow) {
        return NextResponse.json(
          { success: false, error: "Source result not found" },
          { status: 404 },
        );
      }

      const scenarioInput = resultRow.scenario_input as {
        description: string;
      };
      const result = resultRow.result as {
        confidenceLevel: string;
        isCivilMatter: boolean;
        needsClarification: boolean;
        step7Conclusion: string;
        estimatedPunishment: string;
      };

      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          session_id: sessionId,
          scenario_description: scenarioInput.description ?? "",
          model_id: resultRow.model_id,
          confidence_level: result.confidenceLevel,
          is_civil_matter: result.isCivilMatter,
          needs_clarification: result.needsClarification,
        })
        .select()
        .single();

      if (convError || !conversation) {
        logger.error("Failed to create conversation:", convError);
        return NextResponse.json(
          { success: false, error: "Failed to create conversation" },
          { status: 500 },
        );
      }

      const summary =
        `**Legal Analysis Complete**\n\n` +
        `**Confidence:** ${result.confidenceLevel}\n\n` +
        `**Summary:**\n${result.step7Conclusion}\n\n` +
        `**Estimated Punishment:** ${result.estimatedPunishment}`;

      // Insert in chronological order: the scenario was the user's input,
      // and the analysis is the assistant's reply to it. The previous
      // ordering (assistant first, then user) made transcripts read
      // backwards in the UI.
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "user",
        content: scenarioInput.description ?? "",
      });

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: summary,
        metadata: { isInitialAnalysis: true, result },
      });

      return NextResponse.json({
        success: true,
        data: { id: conversation.id },
      });
    }

    // Path 2: bare new conversation
    if (!body.modelId || !isValidModelId(body.modelId)) {
      return NextResponse.json(
        { success: false, error: "Invalid model id" },
        { status: 400 },
      );
    }

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        session_id: sessionId,
        scenario_description: "",
        model_id: body.modelId,
      })
      .select()
      .single();

    if (convError || !conversation) {
      logger.error("Failed to create conversation:", convError);
      return NextResponse.json(
        { success: false, error: "Failed to create conversation" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: conversation.id },
    });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    logger.error("POST /api/conversations failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
