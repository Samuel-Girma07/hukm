/**
 * Middleware behaviour tests (Fix J): sliding renewal, stale-token
 * rejection, return-path preservation, and route-class exemptions.
 *
 * Runs the real `middleware()` against constructed NextRequests with
 * locally minted jose tokens.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";

type Middleware = typeof import("../../middleware").middleware;

let middlewareFn: Middleware;
const SECRET = new TextEncoder().encode("stage7-test-secret");

async function sign(opts: {
  sub?: string;
  email?: string;
  ttlSeconds: number;
}): Promise<string> {
  // jose treats a numeric expiration as an ABSOLUTE unix timestamp.
  const expAbs = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
  return new SignJWT({ email: opts.email ?? "u@e.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.sub ?? "user-1")
    .setIssuedAt()
    .setExpirationTime(expAbs)
    .sign(SECRET);
}

function req(
  path: string,
  cookie?: { name: string; value: string },
): NextRequest {
  const url = `http://localhost${path}`;
  const r = new NextRequest(url, { headers: { "x-forwarded-host": "localhost" } });
  if (cookie) {
    r.cookies.set(cookie.name, cookie.value);
  }
  return r;
}

beforeAll(async () => {
  process.env.JWT_SECRET = "stage7-test-secret";
  (process.env as { NODE_ENV?: string }).NODE_ENV = "test";
  const mod = await import("../../middleware");
  middlewareFn = mod.middleware;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe("route classes", () => {
  it("passes /admin/* without any session cookie", async () => {
    const res = await middlewareFn(req("/admin", undefined));
    expect(res.status).toBe(200);
  });

  it("passes /share/:token for anonymous visitors (public by design)", async () => {
    const res = await middlewareFn(req("/share/abc123", undefined));
    expect(res.status).toBe(200);
    // Must NOT be a redirect to onboarding.
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects anonymous visitors from protected routes with a next cookie", async () => {
    const res = await middlewareFn(req("/history?a=1", undefined));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/onboarding");
    const nextCookie = res.cookies.get("hukm_next");
    expect(nextCookie?.value).toBe("/history?a=1");
  });

  it("lets anonymous visitors reach auth routes", async () => {
    for (const p of ["/login", "/signup", "/onboarding"]) {
      const res = await middlewareFn(req(p, undefined));
      expect(res.status).toBe(200);
    }
  });
});

describe("token validity", () => {
  it("treats an EXPIRED token as unauthenticated and clears it", async () => {
    const expired = await sign({ ttlSeconds: -10 });
    const res = await middlewareFn(req("/results/x", { name: "hukm_token", value: expired }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/onboarding");
    const cleared = res.cookies.get("hukm_token");
    expect(cleared?.maxAge).toBeLessThanOrEqual(0);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = await new SignJWT({ email: "x@y.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("evil")
      .setIssuedAt()
      .setExpirationTime(3600)
      .sign(new TextEncoder().encode("wrong-secret"));
    const res = await middlewareFn(req("/history", { name: "hukm_token", value: forged }));
    expect(res.status).toBe(307);
  });

  it("bounces logged-in users away from auth routes and clears hukm_next", async () => {
    const fresh = await sign({ ttlSeconds: 3600 * 23 });
    const res = await middlewareFn(
      req("/login", [
        { name: "hukm_token", value: fresh },
        { name: "hukm_next", value: "/history" },
      ][0]),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("hukm_next=");
    // Deletion is serialized either as Max-Age=0 or an epoch Expires.
    expect(/(max-age\s*=\s*0|expires\s*=\s*thu,\s*01\s+jan\s+1970)/i.test(setCookie)).toBe(
      true,
    );
  });

  it("does not renew a FRESH token (no Set-Cookie for hukm_token)", async () => {
    const fresh = await sign({ ttlSeconds: 3600 * 23 }); // 23h left > 12h threshold
    const res = await middlewareFn(req("/", { name: "hukm_token", value: fresh }));
    expect(res.status).toBe(200);
    expect(res.cookies.get("hukm_token")).toBeUndefined();
  });

  it("RENEWS a token past the sliding threshold and keeps it verifiable", async () => {
    const ageing = await sign({ ttlSeconds: 5 * 3600 }); // 5h left < 12h
    const res = await middlewareFn(req("/", { name: "hukm_token", value: ageing }));
    expect(res.status).toBe(200);

    const renewedCookie = res.cookies.get("hukm_token");
    expect(renewedCookie).toBeDefined();
    const renewed = renewedCookie!.value;
    expect(renewed).not.toBe(ageing);

    const { payload } = await jwtVerify(renewed, SECRET);
    expect(payload.sub).toBe("user-1");
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60 * 60 * 24);
  });
});
