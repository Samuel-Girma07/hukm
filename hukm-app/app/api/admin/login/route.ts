/**
 * /api/admin/login
 *
 * GET  — Returns whether admin auth is configured. Does NOT leak the
 *        password digest (the old version did, which allowed offline
 *        brute-force attacks).
 *
 * POST — Accepts { password } in the body. Validates server-side using
 *        a constant-time comparison, then sets an HTTP-only
 *        `hukm-admin-auth` cookie containing an HMAC-signed token.
 *
 * DELETE — Clears the admin cookie (logout).
 */

import { NextRequest, NextResponse } from "next/server";

import {
  clearAdminCookie,
  isAdminConfigured,
  mintAdminToken,
  setAdminCookie,
  verifyAdminPassword,
} from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginRequestBody {
  password?: unknown;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    configured: isAdminConfigured(),
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  // If admin isn't configured, refuse up front.
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: "Admin auth is not configured.", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length === 0) {
    return NextResponse.json(
      { success: false, error: "Password is required.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  if (!verifyAdminPassword(password)) {
    // Constant-time comparison already happened. Return a generic error
    // so attackers can't distinguish "wrong password" from "missing user".
    return NextResponse.json(
      { success: false, error: "Invalid password.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const token = mintAdminToken();
  const response = NextResponse.json({ success: true });
  setAdminCookie(response, token);
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  clearAdminCookie(response);
  return response;
}
