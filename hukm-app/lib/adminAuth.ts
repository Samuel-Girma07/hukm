/**
 * HUKM — Admin authentication helpers.
 *
 * Design:
 *   Admin auth uses a single shared password (ADMIN_PASSWORD env var). We
 *   do NOT use Supabase Auth for admins — they're a separate trust tier.
 *
 * Flow:
 *   1. Client POSTs { password } to /api/admin/login.
 *   2. Server compares with `crypto.timingSafeEqual` against ADMIN_PASSWORD.
 *   3. On success, server sets an HTTP-only cookie `hukm-admin-auth`
 *      containing a HMAC-signed token. The token is `timestamp.hmac`
 *      where hmac = HMAC-SHA256(ADMIN_PASSWORD, timestamp). This means:
 *        - We can verify the token without storing the password in the
 *          cookie (just the timestamp + signature).
 *        - Rotating ADMIN_PASSWORD invalidates all existing admin cookies
 *          automatically (HMAC verification fails).
 *        - The token has no expiry encoded in it — we rely on the cookie's
 *          `maxAge` for that. If you want sliding expiry, re-set the
 *          cookie on every successful admin API call.
 *
 * Cookie name: hukm-admin-auth
 *
 * Why not just store a session id and look it up?
 *   We don't have a sessions table for admins, and adding one for a
 *   single shared password is overkill. The HMAC approach is stateless
 *   and sufficient for this threat model.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { NextResponse } from "next/server";
import { jsonError } from "./http";

export const ADMIN_COOKIE_NAME = "hukm-admin-auth";
/** 7 days — admins shouldn't have to re-login constantly, but not forever. */
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getAdminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.trim().length === 0) return null;
  return pw;
}

/**
 * Returns true if ADMIN_PASSWORD is configured. Used by the login page
 * to show a "not configured" state instead of failing at login.
 */
export function isAdminConfigured(): boolean {
  return getAdminPassword() !== null;
}

/**
 * Constant-time password comparison.
 * Both inputs must be the same length for `timingSafeEqual` — we pad the
 * shorter one with zeros so length differences don't short-circuit.
 */
export function verifyAdminPassword(submitted: string): boolean {
  const actual = getAdminPassword();
  if (actual === null) return false;

  const submittedBuf = Buffer.from(submitted, "utf8");
  const actualBuf = Buffer.from(actual, "utf8");
  const maxLen = Math.max(submittedBuf.length, actualBuf.length);

  const paddedSubmitted = Buffer.alloc(maxLen);
  const paddedActual = Buffer.alloc(maxLen);
  submittedBuf.copy(paddedSubmitted);
  actualBuf.copy(paddedActual);

  return timingSafeEqual(paddedSubmitted, paddedActual);
}

/**
 * Mints a signed admin token: `<timestamp>.<hmac>`.
 * The HMAC is computed over the timestamp using ADMIN_PASSWORD as the key.
 * We include a timestamp so we could enforce max-age in the future without
 * a separate expiry column.
 */
export function mintAdminToken(): string {
  const pw = getAdminPassword();
  if (pw === null) throw new Error("Admin not configured");
  const ts = Date.now().toString(36);
  const hmac = createHmac("sha256", pw).update(ts, "utf8").digest("hex");
  return `${ts}.${hmac}`;
}

/**
 * Verifies a token produced by `mintAdminToken()`. Returns true if the
 * signature matches AND the token is younger than COOKIE_MAX_AGE_SECONDS.
 */
export function verifyAdminToken(token: string): boolean {
  const pw = getAdminPassword();
  if (pw === null) return false;

  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) return false;

  const tsPart = token.slice(0, dotIdx);
  const sigPart = token.slice(dotIdx + 1);

  // Reject if timestamp is not valid base36.
  const tsNum = Number.parseInt(tsPart, 36);
  if (!Number.isFinite(tsNum)) return false;

  // Check max age.
  const ageMs = Date.now() - tsNum;
  if (ageMs < 0 || ageMs > COOKIE_MAX_AGE_SECONDS * 1000) return false;

  // Recompute HMAC and compare.
  const expectedSig = createHmac("sha256", pw)
    .update(tsPart, "utf8")
    .digest("hex");

  // Constant-time compare of the hex signatures.
  if (sigPart.length !== expectedSig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sigPart), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

/**
 * Sets the admin auth cookie on a NextResponse. Call this from the login
 * route handler after a successful password check.
 */
export function setAdminCookie(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

/**
 * Clears the admin auth cookie. Call this from the logout route handler.
 */
export function clearAdminCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/**
 * Reads the admin cookie from a NextRequest (Route Handler context).
 * Returns true if the cookie exists and verifies.
 */
export function isRequestAdmin(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

/**
 * Reads the admin cookie from next/headers cookies() (Server Component
 * or Server Action context). Returns true if verified.
 */
export async function isServerAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

/**
 * Guard for admin API routes. Returns null if the caller is authed,
 * otherwise returns a NextResponse with 401 that the route should return.
 *
 * Usage:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 *   // ... rest of handler
 */
export function requireAdmin(
  request: NextRequest,
): NextResponse | null {
  if (isRequestAdmin(request)) return null;
  return jsonError(401, "Admin authentication required.", "ADMIN_UNAUTHORIZED");
}
