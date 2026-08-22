/**
 * Route-level tests for POST /api/admin/login (Fix D).
 *
 * Exercises the real handler against the in-memory rate limiter so the
 * brute-force ceiling is verified end-to-end at unit speed: five 401s,
 * then a 429 with Retry-After, correct-password-still-blocked, and
 * per-IP bucket isolation.
 */

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../../app/api/admin/login/route";

const ATTACKER_IP = "203.0.113.77";
const VICTIM_IP = "198.51.100.9";

function loginRequest(password: unknown, ip: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ password }),
  });
}

describe("POST /api/admin/login brute-force throttle", () => {
  process.env.ADMIN_PASSWORD = "stage3-test-password";

  it("allows 5 attempts then blocks the 6th with 429 + Retry-After", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LOGIN_ATTEMPTS_TOTAL; i += 1) {
      const res = await POST(loginRequest(`wrong-guess-${i}`, ATTACKER_IP));
      statuses.push(res.status);
    }
    expect(statuses).toEqual(
      Array(5).fill(401).concat([429]),
    );

    const blocked = await POST(loginRequest("wrong", ATTACKER_IP));
    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers.get("Retry-After"));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);

    const body = (await blocked.json()) as { code?: string };
    expect(body.code).toBe("RATE_LIMIT");
  });

  it("blocks even the CORRECT password while the bucket is exhausted", async () => {
    const res = await POST(
      loginRequest("stage3-test-password", ATTACKER_IP),
    );
    expect(res.status).toBe(429);
  });

  it("does not leak attempts across client IPs", async () => {
    const res = await POST(loginRequest("stage3-test-password", VICTIM_IP));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success?: boolean };
    expect(body.success).toBe(true);
    // Successful login sets the HTTP-only admin cookie.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("hukm-admin-auth=");
  });

  it("GET /api/admin/login stays reachable regardless of POST throttling", async () => {
    const { GET } = await import("../../app/api/admin/login/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configured?: boolean };
    expect(body.configured).toBe(true);
  });
});

const LOGIN_ATTEMPTS_TOTAL = 6;
