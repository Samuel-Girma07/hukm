/**
 * HUKM — Sentry server config.
 *
 * No-op when SENTRY_DSN is unset.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn && dsn.trim().length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    debug: false,
    enabled: process.env.NODE_ENV === "production",
  });
}
