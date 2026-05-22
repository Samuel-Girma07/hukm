/**
 * GET /api/conversations/[id]
 *
 * Returns a single conversation (metadata + messages) when the caller's
 * session owns it. Used by the /chat/[conversationId] page on load.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isConversationOwner } from "@/lib/ownership";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { ConfidenceLevel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ConversationRow {
  id: string;
  scenario_description: string | null;
  model_id: string;
  confidence_level: ConfidenceLevel | null;
  is_civil_matter: boolean;
  needs_clarification: boolean;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const id = params.id?.trim();
  if (!id) {
    return jsonError(400, "Missing conversation id.", "VALIDATION");
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(404, "Conversation not found.", "NOT_FOUND");
  }

  const owns = await isConversationOwner(id, sessionId);
  if (!owns) {
    return jsonError(404, "Conversation not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();
  const conversationLookup = await supabase
    .from("conversations")
    .select(
      "id, scenario_description, model_id, confidence_level, is_civil_matter, needs_clarification, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle<ConversationRow>();

  if (conversationLookup.error || !conversationLookup.data) {
    logger.error("[conversations/[id]] read failed", {
      id,
      error: conversationLookup.error?.message,
    });
    return jsonError(500, "Could not load the conversation.", "DB_READ");
  }

  const messagesLookup = await supabase
    .from("messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  if (messagesLookup.error) {
    logger.error("[conversations/[id]] messages read failed", {
      id,
      error: messagesLookup.error.message,
    });
    return jsonError(500, "Could not load conversation messages.", "DB_READ");
  }

  return NextResponse.json({
    success: true,
    conversation: conversationLookup.data,
    messages: messagesLookup.data ?? [],
    sessionId,
  });
}

/**
 * DELETE /api/conversations/[id]
 *
 * Soft-deletes the conversation by setting `deleted_at`. The history
 * page filters by `deleted_at IS NULL` so the row vanishes from the UI
 * without losing the underlying data (admins can still inspect it).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const id = params.id?.trim();
  if (!id) {
    return jsonError(400, "Missing conversation id.", "VALIDATION");
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(404, "Conversation not found.", "NOT_FOUND");
  }

  const owns = await isConversationOwner(id, sessionId);
  if (!owns) {
    return jsonError(404, "Conversation not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logger.error("[conversations/[id]] delete failed", {
      id,
      error: error.message,
    });
    return jsonError(500, "Could not delete the conversation.", "PERSIST_FAILED");
  }

  return NextResponse.json({ success: true });
}
