/**
 * HUKM — Tiered, swappable rate limiter.
 *
 *   - MemoryRateLimiter: a single-process Map-based implementation. The
 *     default; HMR-safe via `globalThis` so we don't stack timers in dev.
 *
 *   - RedisRateLimiter: ioredis running an atomic Lua fixed-window script
 *     (INCR + conditional PEXPIRE + PTTL in one EVAL). Use this when
 *     running multiple Next.js replicas behind a load balancer.
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

export class MemoryRateLimiter implements RateLimiter {
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

/**
 * Atomic fixed-window increment.
 *
 * EXPIRE runs ONLY when the counter is created (count == 1), so the window
 * boundary is pinned to the first hit. The previous implementation ran
 * PEXPIRE on every request, which slid the window forward indefinitely
 * under sustained traffic and could lock a user out forever.
 *
 * Returns { count, pttl } where pttl is the remaining TTL in ms (or a
 * negative sentinel if the key vanished between calls — callers treat any
 * ttl <= 0 as "full fresh window").
 */
export const FIXED_WINDOW_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: IORedis) {}

  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAtMs: number }> {
    const tag = `hukm:rl:${key}`;
    const reply = (await this.redis.eval(
      FIXED_WINDOW_LUA,
      1,
      tag,
      String(windowMs),
    )) as [number, number];

    const count = Number(reply?.[0] ?? 1);
    const ttl = Number(reply?.[1] ?? windowMs);
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

/**
 * Minimal structural type satisfied by NextRequest.headers (Route
 * Handlers), ReadonlyHeaders from next/headers (Server Actions), and
 * plain test doubles. Only `get` is ever needed.
 */
export interface HeadersLike {
  headers: { get(name: string): string | null };
}

/** Shared hit-and-evaluate used by every endpoint/auth limiter. */
async function limitByKey(
  key: string,
  max: number,
  windowMs: number,
  failOpenLabel: string,
): Promise<RateLimitOutcome> {
  let entry: { count: number; resetAtMs: number };
  try {
    entry = await rateLimiter.hit(key, windowMs);
  } catch (err) {
    logger.error(`[ratelimit] ${failOpenLabel} limiter.hit() failed; failing open`, err);
    return {
      allowed: true,
      remaining: max,
      limit: max,
      retryAfterSeconds: 1,
    };
  }

  const retryAfterMs = Math.max(0, entry.resetAtMs - Date.now());
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

  if (entry.count > max) {
    return {
      allowed: false,
      remaining: 0,
      limit: max,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - entry.count),
    limit: max,
    retryAfterSeconds,
  };
}

/**
 * Generic rate-limit check for unauthenticated endpoints (events, share
 * views, article lookups, etc.). Uses the client IP (via identifyClient)
 * as the bucket key so anonymous abuse can be throttled.
 *
 * Defaults: 60 requests / minute / IP. Pass `max` and `windowMs` to override.
 *
 * Like checkRateLimit(), this fails open on backend errors (Redis down).
 */
export async function checkEndpointRateLimit(
  request: HeadersLike,
  opts: { endpoint: string; max?: number; windowMs?: number },
): Promise<RateLimitOutcome> {
  const max = opts.max ?? 60;
  const windowMs = opts.windowMs ?? 60_000;
  const identifier = identifyClient(request.headers);
  const key = `ep:${opts.endpoint}:${identifier}`;
  return limitByKey(key, max, windowMs, "endpoint");
}

// ---------------------------------------------------------------------------
// Auth (server actions)
// ---------------------------------------------------------------------------

/**
 * Per-action ceilings for the login/signup server actions, which have no
 * NextRequest to hand to checkEndpointRateLimit(). Successful attempts
 * consume quota too — same policy as /api/admin/login — so attackers can't
 * distinguish outcomes by throughput.
 */
export const AUTH_RATE_LIMITS: Record<
  "login" | "signup",
  { windowMs: number; max: number }
> = {
  login: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 attempts / 15 min
  signup: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 accounts / hour
};

/**
 * Rate-limit an auth server action by client IP. Reads the IP from
 * `next/headers` because Server Actions receive no request object.
 *
 * Fails open (consistent with every other limiter here) if headers()
 * is unavailable outside a request scope or the backend errors.
 */
export async function checkAuthRateLimit(
  action: keyof typeof AUTH_RATE_LIMITS,
): Promise<RateLimitOutcome> {
  const config = AUTH_RATE_LIMITS[action];

  let identifier = "anonymous";
  try {
    const { headers } = await import("next/headers");
    identifier = identifyClient(await headers());
  } catch (err) {
    logger.warn("[ratelimit] could not read request headers for auth limiter", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const key = `ep:auth-${action}:${identifier}`;
  return limitByKey(key, config.max, config.windowMs, `auth-${action}`);
}

/**
 * Extracts the best-guess client IP from proxy headers. When self-hosting
 * without a trusted reverse proxy these headers are client-controlled and
 * MUST NOT be trusted for security decisions — see TRUST_PROXY in
 * .env.example.
 */
export function identifyClient(
  headers: { get(name: string): string | null },
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first && first.trim()) return first.trim();
  }
  const real = headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "anonymous";
}
