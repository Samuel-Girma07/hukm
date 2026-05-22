/**
 * HUKM — Session management.
 *
 * We now use Supabase Auth for session management.
 * This file returns the authenticated user's ID for linking conversations.
 */

import "server-only";
import { createClient } from "./supabase/server";

/**
 * Returns the current authenticated user's ID.
 * Since we protect routes via middleware, this should always return a valid user ID
 * when accessed from protected routes.
 */
export async function getOrCreateSessionId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated.");
  }
  
  return user.id;
}

/**
 * Returns the session id (user ID).
 */
export async function readSessionId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return user ? user.id : null;
}

/**
 * Forcibly logs out the user.
 */
export async function rotateSessionId(): Promise<string> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return "";
}
