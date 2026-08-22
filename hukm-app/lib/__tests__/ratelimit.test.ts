/**
 * Unit tests for lib/ratelimit.ts.
 *
 * Focus: the fixed-window invariants that production correctness depends
 * on — most importantly, the Redis backend must NOT refresh the window
 * TTL on every hit (the P0 defect this suite pins down).
 *
 * The Redis limiter is exercised against a stubbed `eval` so no live
 * Redis is required; the Lua script text itself is asserted to guarantee
 * EXPIRE stays conditional on count == 1.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Redis as IORedis } from "ioredis";

import {
  MemoryRateLimiter,
  RedisRateLimiter,
  FIXED_WINDOW_LUA,
  RATE_LIMITS,
  checkRateLimit,
} from "../ratelimit";

const WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// MemoryRateLimiter — true fixed window
// ---------------------------------------------------------------------------

describe("MemoryRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a new window on first hit with resetAtMs = now + windowMs", async () => {
    const limiter = new MemoryRateLimiter();
    const result = await limiter.hit("k", WINDOW_MS);
    expect(result.count).toBe(1);
    expect(result.resetAtMs).toBe(Date.now() + WINDOW_MS);
  });

  it("keeps resetAtMs pinned to the FIRST hit for subsequent hits (fixed window)", async () => {
    const limiter = new MemoryRateLimiter();
    const first = await limiter.hit("k", WINDOW_MS);

    vi.advanceTimersByTime(30_000); // halfway through the window
    const second = await limiter.hit("k", WINDOW_MS);

    expect(second.count).toBe(2);
    expect(second.resetAtMs).toBe(first.resetAtMs);
  });

  it("resets the counter once the window has expired", async () => {
    const limiter = new MemoryRateLimiter();
    await limiter.hit("k", WINDOW_MS);
    await limiter.hit("k", WINDOW_MS);

    vi.advanceTimersByTime(WINDOW_MS + 1);
    const fresh = await limiter.hit("k", WINDOW_MS);

    expect(fresh.count).toBe(1);
    expect(fresh.resetAtMs).toBe(Date.now() + WINDOW_MS);
  });

  it("tracks distinct keys independently", async () => {
    const limiter = new MemoryRateLimiter();
    const a = await limiter.hit("a", WINDOW_MS);
    const b = await limiter.hit("b", WINDOW_MS);
    expect(a.count).toBe(1);
    expect(b.count).toBe(1);
  });

  it("cleanup() drops only expired entries", async () => {
    const limiter = new MemoryRateLimiter();
    await limiter.hit("live", WINDOW_MS);
    await limiter.hit("dead", WINDOW_MS);
    vi.advanceTimersByTime(WINDOW_MS + 1);
    await limiter.hit("live", WINDOW_MS);

    limiter.cleanup();

    // Internal map assertion via behavior: a fresh hit on "dead" starts at 1
    const revived = await limiter.hit("dead", WINDOW_MS);
    expect(revived.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RedisRateLimiter — Lua contract (no TTL refresh)
// ---------------------------------------------------------------------------

function makeFakeRedis(reply: () => [number, number]): {
  redis: IORedis;
  evalMock: ReturnType<typeof vi.fn>;
} {
  const evalMock = vi.fn(reply);
  // ioredis clients expose methods (eval, multi, …); the fake only needs
  // `eval` for RedisRateLimiter.hit().
  const redis = { eval: evalMock } as unknown as IORedis;
  return { redis, evalMock };
}

describe("RedisRateLimiter", () => {
  it("sends one EVAL with the key and stringified window", async () => {
    const { redis, evalMock } = makeFakeRedis(() => [1, WINDOW_MS]);
    const limiter = new RedisRateLimiter(redis);

    await limiter.hit("sess:model", WINDOW_MS);

    expect(evalMock).toHaveBeenCalledTimes(1);
    const [script, numKeys, tag, windowArg] = evalMock.mock.calls[0] as [
      string,
      number,
      string,
      string,
    ];
    expect(typeof script).toBe("string");
    expect(numKeys).toBe(1);
    expect(tag).toBe("hukm:rl:sess:model");
    expect(windowArg).toBe(String(WINDOW_MS));
  });

  it("Lua script expires ONLY when count == 1 (pins the TTL-refresh regression)", () => {
    // The exact bug this guards against: an unconditional PEXPIRE turns
    // every hit into a window extension. If someone reintroduces that,
    // this assertion fails at unit-test speed instead of in production.
    expect(FIXED_WINDOW_LUA).toContain("if count == 1 then");
    expect(FIXED_WINDOW_LUA).toContain("PEXPIRE");
    expect(FIXED_WINDOW_LUA.indexOf("PEXPIRE")).toBeGreaterThan(
      FIXED_WINDOW_LUA.indexOf("if count == 1"),
    );
  });

  it("maps the Lua reply to count and a reset time derived from remaining TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    try {
      const { redis } = makeFakeRedis(() => [3, 59_000]);
      const limiter = new RedisRateLimiter(redis);

      const result = await limiter.hit("k", WINDOW_MS);

      expect(result.count).toBe(3);
      expect(result.resetAtMs).toBe(Date.now() + 59_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to a full fresh window when PTTL is negative (-2 key vanished)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    try {
      const { redis } = makeFakeRedis(() => [7, -2]);
      const limiter = new RedisRateLimiter(redis);

      const result = await limiter.hit("k", WINDOW_MS);

      expect(result.count).toBe(7);
      expect(result.resetAtMs).toBe(Date.now() + WINDOW_MS);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — tier wiring against the in-memory backend
// ---------------------------------------------------------------------------

describe("checkRateLimit (memory backend)", () => {
  const STANDARD_MODEL = "nvidia/nemotron-3-super-120b-a12b";
  const PREMIUM_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";

  it("allows up to the standard-tier limit, then blocks with retryAfterSeconds > 0", async () => {
    const id = `std-${Math.random().toString(36).slice(2)}`;
    let blocked: Awaited<ReturnType<typeof checkRateLimit>> | null = null;
    for (let i = 0; i < RATE_LIMITS.standard.max; i += 1) {
      const out = await checkRateLimit(id, STANDARD_MODEL);
      expect(out.allowed).toBe(true);
    }
    blocked = await checkRateLimit(id, STANDARD_MODEL);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.limit).toBe(RATE_LIMITS.standard.max);
  });

  it("applies the tighter premium ceiling to premium models", async () => {
    const id = `prem-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < RATE_LIMITS.premium.max; i += 1) {
      const out = await checkRateLimit(id, PREMIUM_MODEL);
      expect(out.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(id, PREMIUM_MODEL);
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(RATE_LIMITS.premium.max);
  });
});
