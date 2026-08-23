/**
 * Route-level tests for GET /api/health.
 *
 * Verifies the contract that matters operationally:
 *   - always 200 (uptime probes must not flap on misconfiguration)
 *   - anonymous callers never see WHICH vars are missing
 *   - admin callers get the full diagnostic payload
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../lib/adminAuth", () => ({
  isRequestAdmin: vi.fn(() => false),
}));

vi.mock("../../lib/migrationCheck", () => ({
  ensureMigrationProbed: vi.fn(),
  getMigrationStatus: vi.fn(async () => ({ missing: [] })),
}));

import { GET } from "../../app/api/health/route";
import { isRequestAdmin } from "../../lib/adminAuth";

const isRequestAdminMock = vi.mocked(isRequestAdmin);

function healthRequest(): NextRequest {
  return new NextRequest("http://localhost/api/health");
}

describe("GET /api/health", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    isRequestAdminMock.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 200 ok with a count-only payload when all vars are present", async () => {
    for (const v of [
      "NVIDIA_API_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "DATABASE_URL",
      "JWT_SECRET",
    ]) {
      process.env[v] = "x";
    }

    const res = await GET(healthRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, configured: true, missingCount: 0 });
    expect(body.missing).toBeUndefined();
  });

  it("stays 200 and hides var NAMES from anonymous callers when config is broken", async () => {
    for (const v of [
      "NVIDIA_API_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "DATABASE_URL",
      "JWT_SECRET",
    ]) {
      delete process.env[v];
    }

    const res = await GET(healthRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      configured?: boolean;
      missingCount?: number;
      missing?: string[];
    };
    expect(body.configured).toBe(false);
    expect(body.missingCount).toBe(6);
    expect(body.missing).toBeUndefined();
  });

  it("exposes the missing var names only to verified admins", async () => {
    // Define the FULL desired state — the ambient env may lack these vars.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "x";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
    delete process.env.NVIDIA_API_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    isRequestAdminMock.mockReturnValue(true);

    const res = await GET(healthRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      missing?: string[];
      migrationMissing?: string[];
    };
    expect([...(body.missing ?? [])].sort()).toEqual([
      "DATABASE_URL",
      "JWT_SECRET",
      "NVIDIA_API_KEY",
    ]);
    expect(body.migrationMissing).toEqual([]);
  });

  it("still returns 200 when the migration probe throws", async () => {
    const { getMigrationStatus } = await import("../../lib/migrationCheck");
    vi.mocked(getMigrationStatus).mockRejectedValueOnce(new Error("db down"));
    isRequestAdminMock.mockReturnValue(true);

    const res = await GET(healthRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { migrationMissing?: string[] };
    expect(body.migrationMissing).toEqual(["probe_failed"]);
  });
});
