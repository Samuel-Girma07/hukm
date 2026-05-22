/**
 * HUKM — Rate Limiter
 *
 * Tiered, per-IP-per-model rate limiting with two backends:
 *
 *   - InMemoryStorage (default): single-process counter map
 *   - RedisStorage (opt-in via REDIS_URL): atomic INCR + EXPIRE so the
 *     limit is enforced across multiple Next.js instances
 *
 * `checkRateLimit` is async and works with either backend.
 */

import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitData {
  count: number;
  resetTime: number; // unix ms
}

// ---------------------------------------------------------------------------
// Storage interface
// ---------------------------------------------------------------------------

export interface RateLimitStorage {
  /**
   * Atomically increment the counter for `key` within a fixed window of
   * `windowMs`. Implementations MUST set/refresh a per-key TTL so memory is
   * reclaimed even if `cleanup` is never called.
   *
   * Returns the post-increment count and the unix-ms reset time.
   */
  hit(key: string, windowMs: number): Promise<RateLimitData>;
}

// ---------------------------------------------------------------------------
// In-memory backend (default)
// ---------------------------------------------------------------------------

class InMemoryStorage implements RateLimitStorage {
  private store = new Map<string, RateLimitData>();

  async hit(key: string, windowMs: number): Promise<RateLimitData> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || now > existing.resetTime) {
      const fresh = { count: 1, resetTime: now + windowMs };
      this.store.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, data] of Array.from(this.store.entries())) {
      if (now > data.resetTime) this.store.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Redis backend (opt-in)
// ---------------------------------------------------------------------------

interface MinimalRedis {
  multi: () => {
    incr: (key: string) => unknown;
    pexpire: (key: string, ms: number) => unknown;
    pttl: (key: string) => unknown;
    exec: () => Promise<Array<[Error | null, unknown]> | null>;
  };
}

class RedisStorage implements RateLimitStorage {
  constructor(private redis: MinimalRedis) {}

  async hit(key: string, windowMs: number): Promise<RateLimitData> {
    const pipeline = this.redis.multi();
    pipeline.incr(key);
    pipeline.pexpire(key, windowMs); // refresh on every hit -> sliding window
    pipeline.pttl(key);
    const replies = await pipeline.exec();

    if (!replies || replies.length === 0) {
      // Pipeline failed; fail-open so the app stays available.
      logger.warn("Redis pipeline returned empty reply; failing open");
      const now = Date.now();
      return { count: 1, resetTime: now + windowMs };
    }

    const count = Number(replies[0]?.[1] ?? 1);
    const ttl = Number(replies[2]?.[1] ?? windowMs);
    const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs);
    return { count, resetTime };
  }
}

// ---------------------------------------------------------------------------
// Lazy storage initialization
//
// We cache the singleton on `globalThis` so Next.js's dev-mode HMR doesn't
// reinstantiate the storage (and the cleanup interval below) every time a
// route module is hot-reloaded. Without this guard, every reload added a
// fresh setInterval handle on `process` and surfaced as the
// "MaxListenersExceededWarning: 11 exit listeners added to [process]"
// warning we observed in dev.
// ---------------------------------------------------------------------------

interface HukmRateLimitGlobals {
  storage?: RateLimitStorage;
  cleanupInterval?: ReturnType<typeof setInterval>;
}

const RATE_LIMIT_GLOBAL_KEY = "__hukmRateLimit" as const;

function getRateLimitGlobals(): HukmRateLimitGlobals {
  const g = globalThis as typeof globalThis & {
    [RATE_LIMIT_GLOBAL_KEY]?: HukmRateLimitGlobals;
  };
  if (!g[RATE_LIMIT_GLOBAL_KEY]) g[RATE_LIMIT_GLOBAL_KEY] = {};
  return g[RATE_LIMIT_GLOBAL_KEY] as HukmRateLimitGlobals;
}

export function configureRateLimitStorage(custom: RateLimitStorage): void {
  getRateLimitGlobals().storage = custom;
}

async function getStorage(): Promise<RateLimitStorage> {
  const globals = getRateLimitGlobals();
  if (globals.storage) return globals.storage;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { default: IORedis } = await import("ioredis");
      const client = new IORedis(redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      client.on("error", (err: unknown) => {
        logger.warn("Redis rate limiter error:", err);
      });
      globals.storage = new RedisStorage(client as unknown as MinimalRedis);
      logger.info("Rate limiter using Redis backend");
      return globals.storage;
    } catch (err) {
      logger.warn(
        "Failed to initialize Redis rate limiter, falling back to in-memory:",
        err,
      );
    }
  }

  globals.storage = new InMemoryStorage();
  return globals.storage;
}

// ---------------------------------------------------------------------------
// Tiered config
// ---------------------------------------------------------------------------

export const PREMIUM_MODELS = new Set(["z-ai/glm5", "z-ai/glm4.7"]);

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  premium: { windowMs: 60 * 1000, maxRequests: 10 },
  fallback: { windowMs: 60 * 1000, maxRequests: 30 },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  /** Requests still allowed in the current window (always defined). */
  remaining: number;
  /** Total cap for the current tier. */
  limit: number;
}

/**
 * Returns whether the request is allowed, plus headers metadata.
 *
 * @param identifier - typically the caller's IP
 * @param modelId    - selected model id (drives the tier)
 */
export async function checkRateLimit(
  identifier: string,
  modelId: string,
): Promise<RateLimitResult> {
  const isPremium = PREMIUM_MODELS.has(modelId);
  const config = isPremium ? RATE_LIMITS.premium : RATE_LIMITS.fallback;
  const key = `${identifier}:${modelId}`;

  const store = await getStorage();
  const { count, resetTime } = await store.hit(key, config.windowMs);

  if (count > config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
    return {
      allowed: false,
      retryAfter,
      remaining: 0,
      limit: config.maxRequests,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - count),
    limit: config.maxRequests,
  };
}

/**
 * Headers attached to every rate-limited response. We always emit
 * `X-RateLimit-Limit` and `X-RateLimit-Remaining` so well-behaved clients
 * can self-throttle without trial-and-error. `Retry-After` is added only
 * when the request was rejected.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
  };
  if (!result.allowed && result.retryAfter !== undefined) {
    headers["Retry-After"] = result.retryAfter.toString();
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Cleanup (in-memory only)
// ---------------------------------------------------------------------------

export async function cleanupRateLimitStore(): Promise<void> {
  const store = await getStorage();
  if (store instanceof InMemoryStorage) store.cleanup();
}

// Schedule the cleanup interval at most ONCE per process (HMR-safe).
function ensureCleanupInterval(): void {
  if (typeof globalThis === "undefined") return;
  const globals = getRateLimitGlobals();
  if (globals.cleanupInterval) return;
  globals.cleanupInterval = setInterval(
    () => {
      cleanupRateLimitStore().catch((err) =>
        logger.warn("Rate limiter cleanup failed:", err),
      );
    },
    5 * 60 * 1000,
  );
  // Don't keep the Node event loop alive purely for this interval.
  if (typeof globals.cleanupInterval.unref === "function") {
    globals.cleanupInterval.unref();
  }
}

ensureCleanupInterval();
