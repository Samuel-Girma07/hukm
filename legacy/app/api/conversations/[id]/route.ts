/**
 * GET /api/conversations/[id]
 *
 * Returns conversation metadata + messages for the calling session.
 */

import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import {
  assertOwnsConversation,
  OwnershipError,
} from "@/lib/ownership";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const sessionId = await getSessionId();
    const supabase = getServerClient();

    await assertOwnsConversation(supabase, params.id, sessionId);

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select(
        "id, session_id, scenario_description, model_id, confidence_level, " +
          "is_civil_matter, needs_clarification, created_at, updated_at",
      )
      .eq("id", params.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 },
      );
    }

    const { data: messages, error: msgError } = await supabase.rpc(
      "get_conversation_messages",
      { p_conversation_id: params.id },
    );

    if (msgError) {
      logger.error("get_conversation_messages failed:", msgError);
      return NextResponse.json(
        { success: false, error: "Failed to load messages" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        messages: messages ?? [],
      },
    });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    logger.error("GET /api/conversations/[id] failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
