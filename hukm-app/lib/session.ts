/**
 * HUKM — Session management.
 *
 * We use Supabase Auth for session management.
 * This file returns the authenticated user's ID for linking conversations.
 *
 * Design notes:
 *   - `getOrCreateSessionId()` returns `string | null`. It returns null when
 *     the user is not authenticated — it does NOT throw. This is critical
 *     because the function is called from Server Components (e.g.
 *     app/chat/[id]/page.tsx, app/history/page.tsx). A thrown error would
 *     bubble up as a 500 page; a returned null lets the caller decide how
 *     to handle unauthenticated access (typically by calling `redirect()`
 *     from next/navigation to send the user to /onboarding).
 *
 *   - `readSessionId()` is the same function with a clearer name for callers
 *     that already know they might get null. Both are kept for backward
 *     compatibility.
 *
 *   - API routes that require auth should check for null and return a 401
 *     JSON response (using the jsonError helper) rather than letting a null
 *     propagate into Supabase queries.
 */

import "server-only";
import { createClient } from "./supabase/server";

/**
 * Returns the current authenticated user's ID, or `null` if not authenticated.
 *
 * Despite the name (kept for backward compat), this does NOT mint a new
 * anonymous session — it simply reads the authenticated Supabase user's ID.
 * Unauthenticated callers get `null`; they should redirect to /onboarding
 * (in Server Components) or return a 401 (in API routes).
 */
export async function getOrCreateSessionId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? user.id : null;
}

/**
 * Returns the session id (user ID), or `null` if not authenticated.
 *
 * Alias for `getOrCreateSessionId()` — same behavior, clearer name.
 */
export async function readSessionId(): Promise<string | null> {
  return getOrCreateSessionId();
}

/**
 * Forcibly logs out the user by signing out of Supabase.
 * Returns an empty string for backward compatibility with old callers
 * that expected a session id return value (the value was unused).
 */
export async function rotateSessionId(): Promise<string> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return "";
}
