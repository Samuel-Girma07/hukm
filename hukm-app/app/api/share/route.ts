/**
 * POST /api/share
 *
 * Creates a publicly-readable share link for an analysis the caller owns.
 * The token is a 12-char nanoid. Idempotency: if the analysis already has
 * a share row from the same session, we return the existing token rather
 * than minting a duplicate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";

import { trackEvent } from "@/lib/analytics";
import { describeDbError, isMigrationPending } from "@/lib/dbErrors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isAnalysisOwner } from "@/lib/ownership";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { CreateShareResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExistingShareRow {
  share_token: string;
}

function publicAppUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.replace(/\/$/, "");
  // Derive from the incoming request as a fallback.
  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateShareResponse>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  const body = raw as { analysisId?: unknown };
  if (typeof body.analysisId !== "string" || body.analysisId.trim().length === 0) {
    return jsonError(400, "`analysisId` is required.", "VALIDATION");
  }
  const analysisId = body.analysisId.trim();

  const sessionId = await readSessionId();
  if (!sessionId) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const owns = await isAnalysisOwner(analysisId, sessionId);
  if (!owns) {
    return jsonError(404, "Analysis not found.", "NOT_FOUND");
  }

  const supabase = getServerClient();

  // Reuse an existing share token from this session if present.
  const existing = await supabase
    .from("shared_analyses")
    .select("share_token")
    .eq("analysis_id", analysisId)
    .eq("created_by_session", sessionId)
    .maybeSingle<ExistingShareRow>();

  if (existing.error && isMigrationPending(existing.error)) {
    const described = describeDbError(
      existing.error,
      "Could not create the share link.",
      "PERSIST_FAILED",
    );
    return jsonError(described.status, described.error, described.code);
  }

  let token = existing.data?.share_token;
  if (!token) {
    token = nanoid(12);
    const { error } = await supabase.from("shared_analyses").insert({
      share_token: token,
      analysis_id: analysisId,
      created_by_session: sessionId,
    });
    if (error) {
      logger.error("[share] failed to insert", {
        error: error.message,
        code: error.code,
      });
      const described = describeDbError(
        error,
        "Could not create the share link.",
        "PERSIST_FAILED",
      );
      return jsonError(described.status, described.error, described.code);
    }
    trackEvent({
      eventType: "share_created",
      sessionId,
      metadata: { analysisId },
    });
  }

  const baseUrl = publicAppUrl(request);
  return NextResponse.json({
    success: true,
    shareUrl: baseUrl ? `${baseUrl}/share/${token}` : `/share/${token}`,
    token,
  });
}
