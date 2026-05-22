/**
 * HUKM — Structured logger.
 *
 * Pino under the hood; pino-pretty in development, JSON in production.
 * Public surface keeps the same shape as the original console-based
 * logger (`logger.info(message, context?)`) so existing call sites
 * continue to compile. The Pino instance itself is exported as
 * `pinoLogger` for places that want pino's `(obj, msg)` API.
 */

import pino, { type Logger } from "pino";

import { hashSession } from "./hash";

const LEVEL = process.env.PINO_LOG_LEVEL ?? "info";

function buildLogger(): Logger {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    return pino({
      level: LEVEL,
      base: undefined,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino({
    level: LEVEL,
    base: { app: "hukm" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const pinoLogger: Logger = buildLogger();

interface LogContext {
  [key: string]: unknown;
}

function normaliseContext(context: LogContext | unknown): LogContext {
  if (context instanceof Error) {
    return {
      err: {
        name: context.name,
        message: context.message,
        stack: context.stack,
      },
    };
  }
  if (context === undefined || context === null) return {};
  if (typeof context !== "object") return { value: context };
  return context as LogContext;
}

export const logger = {
  trace(message: string, context?: LogContext): void {
    pinoLogger.trace(normaliseContext(context), message);
  },
  debug(message: string, context?: LogContext): void {
    pinoLogger.debug(normaliseContext(context), message);
  },
  info(message: string, context?: LogContext): void {
    pinoLogger.info(normaliseContext(context), message);
  },
  warn(message: string, context?: LogContext): void {
    pinoLogger.warn(normaliseContext(context), message);
  },
  error(message: string, context?: LogContext | unknown): void {
    pinoLogger.error(normaliseContext(context), message);
  },
  fatal(message: string, context?: LogContext | unknown): void {
    pinoLogger.fatal(normaliseContext(context), message);
  },
};

/**
 * Returns a request-scoped child logger that automatically attaches the
 * given fields to every log line.
 */
export function requestLogger(fields: LogContext): Logger {
  return pinoLogger.child(fields);
}

/** Re-export so callers can get a sha256 prefix without importing hash directly. */
export { hashSession };
