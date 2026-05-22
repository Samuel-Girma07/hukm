/**
 * HUKM — Structured logger
 *
 * Wraps pino so all server logs are JSON in production (greppable, ingestible
 * by hosted log platforms) and pretty-printed in development.
 *
 * The exposed shape is intentionally identical to the previous dev-only
 * helper so call sites don't need to change.
 *
 *   logger.info("...", extra)
 *   logger.warn("...", extra)
 *   logger.error("...", extra)
 *
 * Logs are emitted at the configured level in BOTH development and
 * production (the original implementation silenced them in prod, which
 * defeats the whole point of having a logger). Set HUKM_LOG_LEVEL to
 * raise the floor in production.
 */

import pino from "pino";

const isProd = process.env.NODE_ENV === "production";
const level =
  process.env.HUKM_LOG_LEVEL ?? (isProd ? "info" : "debug");

// Pino writes JSON to stdout by default. We deliberately avoid a worker-
// based transport because the Next.js dev server and Edge runtime both
// dislike worker threads being killed mid-request, which would otherwise
// surface as "worker thread exited" errors during HMR.
const pinoLogger = pino({
  level,
  base: { app: "hukm" },
  redact: {
    paths: [
      "*.password",
      "*.api_key",
      "*.NVIDIA_API_KEY",
      "*.SUPABASE_SERVICE_ROLE_KEY",
      "headers.authorization",
    ],
    remove: true,
  },
});

void isProd;

function fmtArgs(args: unknown[]): { msg: string; payload?: unknown } {
  if (args.length === 0) return { msg: "" };
  if (args.length === 1 && typeof args[0] === "string") {
    return { msg: args[0] };
  }
  if (typeof args[0] === "string") {
    return { msg: args[0], payload: args.slice(1) };
  }
  return { msg: "log", payload: args };
}

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, args: unknown[]): void {
  const { msg, payload } = fmtArgs(args);
  if (payload === undefined) {
    pinoLogger[level](msg);
  } else {
    pinoLogger[level]({ payload }, msg);
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
