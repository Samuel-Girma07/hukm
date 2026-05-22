/**
 * HUKM — Session Management
 *
 * Handles browser session IDs for conversation tracking. Uses an HttpOnly
 * cookie so JavaScript on the page cannot read or impersonate the session
 * id. The server is the only thing that ever sees / mints the value.
 *
 * (We deliberately do NOT export a client-side reader — an HttpOnly cookie
 * isn't visible from `document.cookie`, so any "client reader" would always
 * return null and create misleading bug reports.)
 */

import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

// Cookie configuration
const SESSION_COOKIE_NAME = "hukm_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_COOKIE_MAX_AGE,
  path: "/",
};

/**
 * Get or create a session ID for the current user.
 * Returns existing session from cookie or creates a new one.
 */
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (existing) return existing;

  const sessionId = uuidv4();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, COOKIE_OPTIONS);
  return sessionId;
}

/**
 * Forcibly mint a new session id (used when the user wants to "start fresh").
 */
export async function createNewSession(): Promise<string> {
  const cookieStore = await cookies();
  const sessionId = uuidv4();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, COOKIE_OPTIONS);
  return sessionId;
}
