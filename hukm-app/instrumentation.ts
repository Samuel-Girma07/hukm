/**
 * HUKM — Next.js instrumentation hook.
 *
 * Runs once per server worker at startup. Sentry is only initialized
 * when SENTRY_DSN is present, so deployments without monitoring stay
 * zero-cost.
 *
 * The previous version of this file lived at the repo root, but the
 * deployed app is `hukm-app/` (Vercel Root Directory setting). Next.js
 * only auto-discovers `instrumentation.ts` in the app root, so the
 * root-level file was never executed — Sentry was silently disabled
 * in production.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || dsn.trim().length === 0) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      environment: process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === "production",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      environment: process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}
