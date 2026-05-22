/**
 * POST /api/events
 *
 * Tracking endpoint for client-side events (theme/language toggles,
 * PDF exports, share creations, etc.). Always returns 204 unless the
 * body is malformed; failures during the actual insert are swallowed
 * so the client never sees them.
 */

import { NextResponse, type NextRequest } from "next/server";

import { isValidEventType, trackEvent } from "@/lib/analytics";
import { jsonError } from "@/lib/http";
import { readSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_METADATA_BYTES = 4 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonError(400, "Request body must be an object.", "VALIDATION");
  }

  const body = raw as Record<string, unknown>;
  const eventType = body.eventType;
  if (typeof eventType !== "string" || !isValidEventType(eventType)) {
    return jsonError(400, "Unknown event type.", "VALIDATION");
  }

  const language = body.language;
  let normalisedLanguage: "en" | "am" | undefined;
  if (language === "en" || language === "am") {
    normalisedLanguage = language;
  }

  let metadata: Record<string, unknown> | undefined;
  if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
    const json = JSON.stringify(body.metadata);
    if (json.length <= MAX_METADATA_BYTES) {
      metadata = body.metadata as Record<string, unknown>;
    }
  }

  const sessionId = (await readSessionId()) ?? "anonymous";
  trackEvent({
    eventType,
    sessionId,
    modelId: typeof body.modelId === "string" ? body.modelId : null,
    crimeCategory:
      typeof body.crimeCategory === "string" ? body.crimeCategory : null,
    confidenceLevel:
      typeof body.confidenceLevel === "string" ? body.confidenceLevel : null,
    language: normalisedLanguage,
    metadata,
  });

  return NextResponse.json({ success: true }, { status: 202 });
}
