/**
 * GET /api/admin/confidence-calibration
 *
 * Returns an empirical calibration report that correlates user feedback
 * with retrieval statistics. Use this to tune confidence thresholds
 * based on actual data rather than guesswork.
 *
 * Auth: requires the `hukm-admin-auth` cookie set by POST /api/admin/login.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { generateCalibrationReport, hasEnoughFeedbackData } from "@/lib/calibration";
import type { CalibrationReport } from "@/lib/calibration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CalibrationSuccessResponse {
  success: true;
  report: CalibrationReport;
  hasEnoughData: boolean;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<CalibrationSuccessResponse | { success: false; error: string; code?: string }>> {
  const denied = requireAdmin(request);
  if (denied) {
    return denied as NextResponse<
      CalibrationSuccessResponse | { success: false; error: string; code?: string }
    >;
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
