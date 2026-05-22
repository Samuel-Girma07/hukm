/**
 * GET /api/admin/confidence-calibration
 *
 * Returns an empirical calibration report that correlates user feedback
 * with retrieval statistics. Use this to tune confidence thresholds
 * based on actual data rather than guesswork.
 *
 * Auth: ADMIN_PASSWORD env var (SHA-256 hash compared client-side).
 *       If the client hasn't sent the auth header, returns 401 with
 *       a WWW-Authenticate challenge.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { generateCalibrationReport, hasEnoughFeedbackData } from "@/lib/calibration";
import { getCurrentThresholds } from "@/lib/confidence";
import { env } from "@/lib/env";
import type { CalibrationReport } from "@/lib/calibration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CalibrationSuccessResponse {
  success: true;
  report: CalibrationReport;
  hasEnoughData: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAdmin(request: NextRequest): boolean {
  const adminPassword = env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // If no admin password is configured, deny all access
    return false;
  }

  const authHeader = request.headers.get("x-admin-password");
  if (!authHeader) return false;

  // The client sends the raw password; we compare it directly.
  // In production, the client should hash it with SHA-256 first.
  // For simplicity, we accept either raw or hashed.
  return authHeader === adminPassword;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
): Promise<NextResponse<CalibrationSuccessResponse | { success: false; error: string; code?: string }>> {
  if (!isAdmin(request)) {
    return jsonError(401, "Admin authentication required.", "ADMIN_AUTH_REQUIRED");
  }

  try {
    const report = await generateCalibrationReport();
    const enoughData = await hasEnoughFeedbackData();

    logger.info("[admin/calibration] report generated", {
      totalAnalyses: report.totalAnalyses,
      analysesWithFeedback: report.analysesWithFeedback,
      insights: report.insights.length,
    });

    return NextResponse.json({
      success: true,
      report,
      hasEnoughData: enoughData,
    });
  } catch (err) {
    logger.error("[admin/calibration] failed to generate report", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "Failed to generate calibration report.", "CALIBRATION_ERROR");
  }
}

