/**
 * HUKM — Server-side usage analytics.
 *
 * Fire-and-forget inserts into `usage_events`. The contract is:
 *
 *   - trackEvent NEVER throws.
 *   - trackEvent NEVER awaits in the request path. Calls return
 *     immediately; the insert runs on the event loop's microtask queue.
 *   - trackEvent NEVER blocks a route from responding.
 *
 * For client-side events (theme/language/share/etc.), the client posts
 * to /api/events which is a thin wrapper around `trackEvent`.
 */

import "server-only";

import { logger } from "./logger";
import { getServerClient } from "./supabase";

export type UsageEventType =
  | "analyze"
  | "chat"
  | "export_pdf"
  | "share_created"
  | "share_viewed"
  | "feedback_submitted"
  | "article_viewed"
  | "language_changed"
  | "theme_changed";

export interface UsageEventPayload {
  eventType: UsageEventType;
  sessionId: string;
  modelId?: string | null;
  crimeCategory?: string | null;
  confidenceLevel?: string | null;
  language?: "en" | "am";
  metadata?: Record<string, unknown>;
}

/**
 * Insert a usage event. Bounded-await contract:
 *
 *   - NEVER throws (failures logged at debug level).
 *   - Resolves within `timeoutMs` even if the database is unreachable, so
 *     awaiting it in a route adds a hard latency ceiling.
 *   - Callers on hot paths AWAIT this so the insert is guaranteed to run
 *     before the response flushes (fire-and-forget writes are dropped when
 *     serverless functions freeze after responding).
 */
export async function trackEvent(
  payload: UsageEventPayload,
  timeoutMs = 1_500,
): Promise<void> {
  try {
    await Promise.race([
      writeEvent(payload),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), Math.max(0, timeoutMs)),
      ),
    ]);
  } catch (err) {
    logger.debug("[analytics] insert failed (ignored)", {
      eventType: payload.eventType,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function writeEvent(payload: UsageEventPayload): Promise<void> {
  const supabase = getServerClient();
  await supabase.from("usage_events").insert({
    event_type: payload.eventType,
    session_id: payload.sessionId,
    model_id: payload.modelId ?? null,
    crime_category: payload.crimeCategory ?? null,
    confidence_level: payload.confidenceLevel ?? null,
    language: payload.language ?? "en",
    metadata: payload.metadata ?? {},
  });
}

/**
 * Validates a string against the closed set of usage-event types.
 * Used by /api/events to reject unknown event names.
 */
const VALID_EVENT_TYPES: ReadonlySet<UsageEventType> = new Set([
  "analyze",
  "chat",
  "export_pdf",
  "share_created",
  "share_viewed",
  "feedback_submitted",
  "article_viewed",
  "language_changed",
  "theme_changed",
]);

export function isValidEventType(value: string): value is UsageEventType {
  return VALID_EVENT_TYPES.has(value as UsageEventType);
}

