/**
 * GET /api/session
 *
 * Returns the caller's session id, minting a new one if necessary. The
 * session cookie is HttpOnly so the browser cannot read it from
 * `document.cookie`; this endpoint is the only way for client code to
 * learn the value (which it needs to include in /api/chat bodies).
 */

import { NextResponse } from "next/server";

import { getOrCreateSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const sessionId = await getOrCreateSessionId();
  return NextResponse.json({ success: true, sessionId });
}
