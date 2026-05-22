/**
 * HUKM — Sentry helpers used by API routes.
 *
 * `withSentry(handler, tag)` wraps a route handler so any thrown error
 * is captured to Sentry (when initialised) and logged. The handler
 * itself is responsible for catching expected errors and returning
 * structured JSON; this is just the last-ditch safety net.
 *
 * Sentry is loaded lazily with a try/catch so the app continues
 * functioning even if `@sentry/nextjs` isn't available at runtime.
 */

import "server-only";

import { logger } from "./logger";
import { hashSession } from "./hash";

type SentryModule = typeof import("@sentry/nextjs");

let cached: SentryModule | null | undefined;

function getSentry(): SentryModule | null {
  if (cached !== undefined) return cached;
  if (!process.env.SENTRY_DSN) {
    cached = null;
    return null;
  }
  try {
    cached = require("@sentry/nextjs") as SentryModule;
  } catch {
    cached = null;
  }
  return cached;
}

export interface SentryRequestContext {
  endpoint: string;
  modelId?: string;
  sessionId?: string;
}

export function setRequestContext(ctx: SentryRequestContext): void {
  const Sentry = getSentry();
  if (!Sentry) return;
  Sentry.setTag("endpoint", ctx.endpoint);
  if (ctx.modelId) Sentry.setTag("modelId", ctx.modelId);
  if (ctx.sessionId) {
    Sentry.setUser({ id: hashSession(ctx.sessionId) });
  }
}

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const Sentry = getSentry();
  if (!Sentry) return;
  Sentry.addBreadcrumb({
    category,
    message,
    level: "info",
    data,
  });
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  const Sentry = getSentry();
  if (!Sentry) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/**
 * Wraps an API route handler with a try/catch that logs and reports
 * unexpected errors. The handler should normally return its own
 * structured JSON errors; this only catches things that escape.
 */
export function withSentryHandler<Args extends unknown[], R>(
  endpoint: string,
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    try {
      setRequestContext({ endpoint });
      return await handler(...args);
    } catch (err) {
      logger.error(`[${endpoint}] uncaught handler error`, err);
      captureException(err, { endpoint });
      throw err;
    }
  };
}
