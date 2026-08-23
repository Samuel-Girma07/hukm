/**
 * GET /api/health
 *
 * Uptime / readiness probe.
 *
 *   - Always returns HTTP 200 while the process can serve requests at
 *     all — a load balancer wants "is this process alive", not "is the
 *     app fully configured" (an unconfigured app still answers traffic,
 *     it just degrades).
 *   - Public body reveals only `configured` and a missing-var COUNT —
 *     never WHICH vars are missing, so the endpoint leaks no config
 *     details to anonymous callers.
 *   - Verified admins additionally receive the exact missing var names
 *     plus the DB migration probe result for diagnostics.
 */

import { NextRequest, NextResponse } from "next/server";

import { isRequestAdmin } from "@/lib/adminAuth";
import { getMissingRequiredVars } from "@/lib/env";
import { ensureMigrationProbed, getMigrationStatus } from "@/lib/migrationCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthBody {
  ok: boolean;
  configured: boolean;
  missingCount: number;
  missing?: string[];
  migrationMissing?: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Kick off the one-time schema probe; harmless if already done.
  ensureMigrationProbed();

  const missing = getMissingRequiredVars();

  const body: HealthBody = {
    ok: true,
    configured: missing.length === 0,
    missingCount: missing.length,
  };

  if (isRequestAdmin(request)) {
    body.missing = missing;
    try {
      const { missing: migrationMissing } = await getMigrationStatus();
      body.migrationMissing = migrationMissing;
    } catch {
      // Migration probe requires a working Supabase client; if env vars
      // are broken it throws. The health endpoint must stay 200.
      body.migrationMissing = ["probe_failed"];
    }
  }

  return NextResponse.json(body);
}
