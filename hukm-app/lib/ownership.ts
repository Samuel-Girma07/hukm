/**
 * HUKM — Ownership / authorisation helpers.
 *
 * The chat API needs to verify "the caller's session id matches the session
 * that created this conversation" before responding. Without this, anyone
 * with a conversation id could read or extend a stranger's chat thread.
 *
 * These helpers are tiny, synchronous-looking wrappers around Supabase
 * lookups. They never throw — failures resolve to `false` so callers can
 * return a 403/404 cleanly.
 */

import "server-only";

import { logger } from "./logger";
import { getServerClient } from "./supabase";

interface ConversationOwnershipRow {
  id: string;
  session_id: string;
}

/**
 * Returns true when `conversationId` exists AND belongs to `sessionId`.
 * Returns false when the row is missing OR the session does not match.
 */
export async function isConversationOwner(
  conversationId: string,
  sessionId: string,
): Promise<boolean> {
  if (!conversationId || !sessionId) return false;

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, session_id")
    .eq("id", conversationId)
    .maybeSingle<ConversationOwnershipRow>();

  if (error) {
    logger.error("[ownership] conversation lookup failed", {
      message: error.message,
      code: error.code,
    });
    return false;
  }
  if (!data) return false;
  return data.session_id === sessionId;
}

interface AnalysisOwnershipRow {
  id: string;
  session_id: string;
}

export async function isAnalysisOwner(
  analysisId: string,
  sessionId: string,
): Promise<boolean> {
  if (!analysisId || !sessionId) return false;

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("analysis_results")
    .select("id, session_id")
    .eq("id", analysisId)
    .maybeSingle<AnalysisOwnershipRow>();

  if (error) {
    logger.error("[ownership] analysis lookup failed", {
      message: error.message,
      code: error.code,
    });
    return false;
  }
  if (!data) return false;
  return data.session_id === sessionId;
}
