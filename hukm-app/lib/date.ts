/**
 * HUKM — Stable date formatting helpers.
 *
 * The Problem:
 *   `new Date(iso).toLocaleString()` (and variants) without explicit
 *   locale + timezone options produces different output on the server
 *   (Node.js, defaults to UTC) vs the client (browser, defaults to
 *   user's local timezone). This causes React hydration mismatches
 *   that show up as console warnings and can break interactivity.
 *
 * The Fix:
 *   Always pass an explicit locale + timezone. These helpers use
 *   'en-US' and 'UTC' by default — predictable on both server and
 *   client. If you want user-local time, call the function inside a
 *   useEffect (after hydration) and store the result in state.
 *
 * Usage:
 *   import { formatDate, formatDateTime, formatTime } from "@/lib/date";
 *   <span>{formatDateTime(row.created_at)}</span>
 */

const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIMEZONE = "UTC";

/** Shared Intl.DateTimeFormat instances (creating them is expensive). */
const formatters: Record<string, Intl.DateTimeFormat> = {};

function getFormatter(
  locale: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${timezone}|${JSON.stringify(options)}`;
  let f = formatters[key];
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone });
    formatters[key] = f;
  }
  return f;
}

/**
 * Format an ISO date string as a date only: "2025-06-21".
 * Use for cases where the time component isn't relevant (e.g. blog post dates).
 */
export function formatDate(
  iso: string | Date,
  opts: { locale?: string; timezone?: string } = {},
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (!date || Number.isNaN(date.getTime())) return "";
  return getFormatter(opts.locale ?? DEFAULT_LOCALE, opts.timezone ?? DEFAULT_TIMEZONE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/**
 * Format an ISO date string as a date + time: "Jun 21, 2025, 14:30".
 * Use for timestamps where both components matter (e.g. message sent at).
 */
export function formatDateTime(
  iso: string | Date,
  opts: { locale?: string; timezone?: string } = {},
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (!date || Number.isNaN(date.getTime())) return "";
  return getFormatter(opts.locale ?? DEFAULT_LOCALE, opts.timezone ?? DEFAULT_TIMEZONE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Format an ISO date string as time only: "14:30".
 * Use for chat message bubbles where the date is implicit.
 */
export function formatTime(
  iso: string | Date,
  opts: { locale?: string; timezone?: string } = {},
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (!date || Number.isNaN(date.getTime())) return "";
  return getFormatter(opts.locale ?? DEFAULT_LOCALE, opts.timezone ?? DEFAULT_TIMEZONE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Returns a short relative-time string ("just now", "5m ago", "2h ago",
 * "3d ago") or falls back to formatDate for older timestamps.
 *
 * Computed against the current time AT CALL SITE — call this inside a
 * useEffect + useState pair to avoid hydration mismatch (server time
 * differs from client time).
 */
export function formatRelative(
  iso: string | Date,
  now: Date = new Date(),
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (!date || Number.isNaN(date.getTime())) return "";
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return formatDate(date);
}
