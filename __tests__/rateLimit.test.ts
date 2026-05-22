import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  getRateLimitHeaders,
  configureRateLimitStorage,
  RATE_LIMITS,
  PREMIUM_MODELS,
  RateLimitStorage,
} from "../lib/rateLimit";

describe("rateLimit", () => {
  describe("constants", () => {
    it("defines rate limit configs", () => {
      expect(RATE_LIMITS.premium.maxRequests).toBe(10);
      expect(RATE_LIMITS.fallback.maxRequests).toBe(30);
    });

    it("identifies premium models", () => {
      expect(PREMIUM_MODELS.has("z-ai/glm4.7")).toBe(true);
      expect(PREMIUM_MODELS.has("z-ai/glm5")).toBe(true);
      expect(PREMIUM_MODELS.has("meta/llama-3.3-70b-instruct")).toBe(false);
    });
  });

  describe("checkRateLimit (in-memory backend)", () => {
    const testId = () => `test-${Date.now()}-${Math.random()}`;

    it("allows first request", async () => {
      const result = await checkRateLimit(testId(), "meta/llama-3.3-70b-instruct");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29);
    });

    it("counts requests within window", async () => {
      const id = testId();
      const model = "meta/llama-3.3-70b-instruct";
      const r1 = await checkRateLimit(id, model);
      const r2 = await checkRateLimit(id, model);
      expect(r1.remaining).toBe(29);
      expect(r2.remaining).toBe(28);
    });

    it("blocks after exceeding limit", async () => {
      const id = testId();
      const model = "meta/llama-3.3-70b-instruct";
      for (let i = 0; i < 30; i++) await checkRateLimit(id, model);
      const result = await checkRateLimit(id, model);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("applies lower limit for premium models", async () => {
      const id = testId();
      const model = "z-ai/glm4.7";
      for (let i = 0; i < 10; i++) await checkRateLimit(id, model);
      const result = await checkRateLimit(id, model);
      expect(result.allowed).toBe(false);
    });

    it("tracks different models separately", async () => {
      const id = testId();
      const r1 = await checkRateLimit(id, "z-ai/glm4.7");
      const r2 = await checkRateLimit(id, "meta/llama-3.3-70b-instruct");
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });
  });

  describe("getRateLimitHeaders", () => {
    it("always includes limit + remaining when allowed", () => {
      const headers = getRateLimitHeaders({
        allowed: true,
        remaining: 5,
        limit: 10,
      });
      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("5");
      expect(headers["Retry-After"]).toBeUndefined();
    });

    it("adds Retry-After + limit + remaining=0 when blocked", () => {
      const headers = getRateLimitHeaders({
        allowed: false,
        retryAfter: 30,
        remaining: 0,
        limit: 10,
      });
      expect(headers["Retry-After"]).toBe("30");
      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });

    it("emits limit + remaining headers even at the boundary", () => {
      const headers = getRateLimitHeaders({
        allowed: true,
        remaining: 0,
        limit: 30,
      });
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
      expect(headers["X-RateLimit-Limit"]).toBe("30");
    });
  });

  describe("custom storage backend (e.g. Redis)", () => {
    it("delegates atomic increments to the configured storage", async () => {
      const calls: Array<{ key: string; windowMs: number }> = [];
      let counter = 0;
      const fakeStorage: RateLimitStorage = {
        async hit(key, windowMs) {
          calls.push({ key, windowMs });
          counter += 1;
          return { count: counter, resetTime: Date.now() + windowMs };
        },
      };
      configureRateLimitStorage(fakeStorage);

      const id = `redis-test-${Date.now()}`;
      const r1 = await checkRateLimit(id, "z-ai/glm4.7");
      const r2 = await checkRateLimit(id, "z-ai/glm4.7");
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(9);
      expect(r2.remaining).toBe(8);
      expect(calls.length).toBe(2);
      expect(calls[0].key).toContain("z-ai/glm4.7");
      expect(calls[0].windowMs).toBe(60_000);

      // Reset to in-memory so other tests aren't affected.
      configureRateLimitStorage({
        async hit() {
          return { count: 1, resetTime: Date.now() + 60_000 };
        },
      });
    });
  });
});
