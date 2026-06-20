/**
 * HUKM — Sentry browser config.
 *
 * No-op when SENTRY_DSN is unset, so local development doesn't ship
 * telemetry to a non-existent project.
 *
 * Sentry auto-discovers this file via `@sentry/nextjs` webpack plugin.
 * The .bak extension on the previous version meant Sentry was never
 * initialized in the browser.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn && dsn.trim().length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    debug: false,
    enabled: process.env.NODE_ENV === "production",
  });
}
