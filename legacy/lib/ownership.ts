/**
 * Ownership / session validation helpers.
 *
 * RLS is locked down so only the service-role can read app tables.
 * API routes therefore enforce ownership in code, comparing the caller's
 * cookie-bound session id against the row's session id.
 *
 * IMPORTANT: When the row exists but the caller doesn't own it we deliberately
 * return the SAME 404 "Not found" response we'd return for a non-existent
 * row. Returning a distinct 403 here would let an attacker enumerate valid
 * UUIDs by status code. From the caller's perspective both states are
 * equivalent: "this resource isn't yours."
 */

import { SupabaseClient } from "@supabase/supabase-js";

export class OwnershipError extends Error {
  status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.name = "OwnershipError";
    this.status = status;
  }
}

export async function assertOwnsAnalysisResult(
  supabase: SupabaseClient,
  resultId: string,
  sessionId: string,
): Promise<void> {
  if (!resultId || !sessionId) {
    throw new OwnershipError("Missing identifiers", 400);
  }

  const { data, error } = await supabase
    .from("analysis_results")
    .select("session_id")
    .eq("id", resultId)
    .single();

  if (error || !data || data.session_id !== sessionId) {
    // Same response whether the row is missing or owned by another session.
    throw new OwnershipError("Result not found", 404);
  }
}

export async function assertOwnsConversation(
  supabase: SupabaseClient,
  conversationId: string,
  sessionId: string,
): Promise<void> {
  if (!conversationId || !sessionId) {
    throw new OwnershipError("Missing identifiers", 400);
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("session_id")
    .eq("id", conversationId)
    .single();

  if (error || !data || data.session_id !== sessionId) {
    // Same response whether the row is missing or owned by another session.
    throw new OwnershipError("Conversation not found", 404);
  }
}
