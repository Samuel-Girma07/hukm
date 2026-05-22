/**
 * HUKM — Tiered, swappable rate limiter.
 *
 *   - MemoryRateLimiter: a single-process Map-based implementation. The
 *     default; HMR-safe via `globalThis` so we don't stack timers in dev.
 *
 *   - RedisRateLimiter: ioredis with an atomic `MULTI / INCR / PEXPIRE
 *     / PTTL / EXEC` pipeline. Use this when running multiple Next.js
 *     replicas behind a load balancer.
 *
 * `createRateLimiter()` returns the Redis backend if `REDIS_URL` is set,
 * otherwise the memory backend. Singleton exported as `rateLimiter`.
 *
 * Tiers:
 *   - z-ai/*          → "premium",  10 requests / minute / (ip, modelId)
 *   - everything else → "standard", 30 requests / minute / (ip, modelId)
 */

import "server-only";

import type { Redis as IORedis } from "ioredis";

import { logger } from "./logger";
import { getModelTier, type ModelTier } from "./models";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the window resets. Always > 0. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Atomically increments the counter for `key` within a fixed window.
   * Returns the post-increment count and the unix-ms reset time.
   */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAtMs: number }>;
}

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

/**
 * Per-tier rate limits applied per (ip, modelId).
 *
 * Premium models (Thinking high) are 100B+ flagship / paid-endpoint
 * models that are expensive or capacity-constrained on NVIDIA Build.
 * They get a 5 req/day ceiling. Standard models (Fast through
 * Thinking medium) are workhorses with headroom — 30 req/min.
 */
export const RATE_LIMITS: Record<ModelTier, { windowMs: number; max: number }> = {
  premium: { windowMs: 24 * 60 * 60 * 1000, max: 5 }, // 24 hours
  standard: { windowMs: 60_000, max: 30 },
};

// ---------------------------------------------------------------------------
// Memory backend
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAtMs: number;
}

class MemoryRateLimiter implements RateLimiter {
  private map = new Map<string, RateLimitEntry>();

  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAtMs: number }> {
    const now = Date.now();
    const existing = this.map.get(key);
    if (!existing || existing.resetAtMs <= now) {
      const fresh: RateLimitEntry = { count: 1, resetAtMs: now + windowMs };
      this.map.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  cleanup(now = Date.now()): void {
    for (const [key, entry] of this.map) {
      if (entry.resetAtMs <= now) this.map.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Redis backend
// ---------------------------------------------------------------------------

class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: IORedis) {}

  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAtMs: number }> {
    const tag = `hukm:rl:${key}`;
    // Atomic pipeline: increment, refresh TTL, read remaining TTL.
    const replies = await this.redis
      .multi()
      .incr(tag)
      .pexpire(tag, windowMs)
      .pttl(tag)
      .exec();

    if (!replies || replies.length === 0) {
      logger.warn("[ratelimit] Redis pipeline returned empty reply, failing open");
      return { count: 1, resetAtMs: Date.now() + windowMs };
    }

    const count = Number(replies[0]?.[1] ?? 1);
    const ttl = Number(replies[2]?.[1] ?? windowMs);
    const resetAtMs = Date.now() + (ttl > 0 ? ttl : windowMs);
    return { count, resetAtMs };
  }
}

// ---------------------------------------------------------------------------
// Factory + singleton (HMR-safe)
// ---------------------------------------------------------------------------

interface RateLimitGlobals {
  limiter?: RateLimiter;
  cleanupTimer?: ReturnType<typeof setInterval>;
  redis?: IORedis;
}

const GLOBAL_KEY = "__hukmRateLimit" as const;

function getGlobals(): RateLimitGlobals {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: RateLimitGlobals;
  };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = {};
  return g[GLOBAL_KEY];
}

/**
 * Build (or return) the singleton rate limiter. Returns Redis if
 * `REDIS_URL` is set and ioredis can be loaded; falls back to memory
 * otherwise. Always synchronous from the caller's POV — even when we
 * end up using Redis we don't await the connection here, since
 * ioredis lazy-connects on first command.
 */
export function createRateLimiter(): RateLimiter {
  const globals = getGlobals();
  if (globals.limiter) return globals.limiter;

  const url = process.env.REDIS_URL;
  if (url && url.trim().length > 0) {
    try {
      // Dynamic require avoids loading ioredis when REDIS_URL is unset.
      const ioredisModule = require("ioredis") as {
        default: new (url: string, opts?: object) => IORedis;
      };
      const RedisCtor = ioredisModule.default;
      const client = new RedisCtor(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      client.on("error", (err: Error) => {
        logger.warn("[ratelimit] Redis client error", { message: err.message });
      });
      globals.redis = client;
      globals.limiter = new RedisRateLimiter(client);
      logger.info("[ratelimit] using Redis backend");
      return globals.limiter;
    } catch (err) {
      logger.warn("[ratelimit] Failed to initialise Redis; falling back to memory", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const mem = new MemoryRateLimiter();
  globals.limiter = mem;

  if (!globals.cleanupTimer) {
    globals.cleanupTimer = setInterval(
      () => mem.cleanup(),
      5 * 60 * 1000,
    );
    if (typeof globals.cleanupTimer.unref === "function") {
      globals.cleanupTimer.unref();
    }
  }

  logger.info("[ratelimit] using in-memory backend");
  return globals.limiter;
}

export const rateLimiter: RateLimiter = createRateLimiter();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Atomically checks (and increments) the rate-limit counter for the
 * given identifier and model. Always returns; on a backend failure
 * (e.g. Redis unreachable), fails open with a permissive outcome.
 */
export async function checkRateLimit(
  identifier: string,
  modelId: string,
): Promise<RateLimitOutcome> {
  const tier = getModelTier(modelId);
  const config = RATE_LIMITS[tier];
  const key = `${identifier}:${modelId}`;

  let entry: { count: number; resetAtMs: number };
  try {
    entry = await rateLimiter.hit(key, config.windowMs);
  } catch (err) {
    logger.error("[ratelimit] limiter.hit() failed; failing open", err);
    return {
      allowed: true,
      remaining: config.max,
      limit: config.max,
      retryAfterSeconds: 1,
    };
  }

  const retryAfterMs = Math.max(0, entry.resetAtMs - Date.now());
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

  if (entry.count > config.max) {
    return {
      allowed: false,
      remaining: 0,
      limit: config.max,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.max - entry.count),
    limit: config.max,
    retryAfterSeconds,
  };
}

export function rateLimitHeaders(
  outcome: RateLimitOutcome,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(outcome.limit),
    "X-RateLimit-Remaining": String(outcome.remaining),
  };
  if (!outcome.allowed) {
    headers["Retry-After"] = String(outcome.retryAfterSeconds);
  }
  return headers;
}

export function identifyClient(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first && first.trim()) return first.trim();
  }
  const real = headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "anonymous";
}
