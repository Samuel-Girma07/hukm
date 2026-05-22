/**
 * GET /api/admin/login
 *
 * Returns the SHA-256 digest of the configured ADMIN_PASSWORD. The
 * client-side login flow takes the entered password, hashes it, and
 * compares the digest. The actual password never leaves the server.
 *
 * If ADMIN_PASSWORD is unset, returns { configured: false } so the
 * UI can show a clear "not configured" state instead of failing at
 * login.
 */

import { NextResponse } from "next/server";

import { sha256Hex } from "@/lib/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.trim().length === 0) {
    return NextResponse.json({ success: true, configured: false });
  }
  return NextResponse.json({
    success: true,
    configured: true,
    digest: sha256Hex(adminPassword),
  });
}
