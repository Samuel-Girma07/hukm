/**
 * GET /api/admin/stats
 *
 * Aggregates analytics for the admin dashboard. Requires admin auth
 * (the `hukm-admin-auth` cookie set by POST /api/admin/login).
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { describeDbError } from "@/lib/dbErrors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getServerClient } from "@/lib/supabase";
import type {
  AdminStatsResponse,
  ConfidenceLevel,
  FeedbackComment,
  FeedbackRating,
  UsageStatsRow,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_WINDOW_DAYS = 30;

interface UsageEventForBuckets {
  event_type: string;
  model_id: string | null;
  confidence_level: string | null;
  language: string | null;
  created_at: string;
}

interface FeedbackRowMinimal {
  id: string;
  rating: FeedbackRating;
  comment: string | null;
  created_at: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const supabase = getServerClient();

  try {
    const since = new Date(
      Date.now() - TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [statsRpc, eventsRows, feedbackRows] = await Promise.all([
      supabase.rpc("get_usage_stats"),
      supabase
        .from("usage_events")
        .select("event_type, model_id, confidence_level, language, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .returns<UsageEventForBuckets[]>(),
      supabase
        .from("feedback")
        .select("id, rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<FeedbackRowMinimal[]>(),
    ]);

    const firstError = statsRpc.error ?? eventsRows.error ?? feedbackRows.error;
    if (firstError) {
      logger.error("[admin/stats] read failed", {
        error: firstError.message,
        code: firstError.code,
      });
      const described = describeDbError(
        firstError,
        "Could not load admin stats.",
        "DB_READ",
      );
      return jsonError(described.status, described.error, described.code);
    }

    const totals: UsageStatsRow = (
      (statsRpc.data as UsageStatsRow[] | null)?.[0] as
        | UsageStatsRow
        | undefined
    ) ?? {
      total_analyses: 0,
      total_chats: 0,
      top_model: null,
      top_crime_category: null,
    };

    // Per-day buckets (analyses + chats).
    const perDayMap = new Map<string, { analyses: number; chats: number }>();
    const byConfidence = new Map<ConfidenceLevel, number>();
    const byModel = new Map<string, number>();
    const byLanguage = new Map<string, number>();
    for (const row of eventsRows.data ?? []) {
      const date = row.created_at.slice(0, 10);
      const bucket = perDayMap.get(date) ?? { analyses: 0, chats: 0 };
      if (row.event_type === "analyze") bucket.analyses += 1;
      else if (row.event_type === "chat") bucket.chats += 1;
      perDayMap.set(date, bucket);

      if (row.event_type === "analyze") {
        const lvl = (row.confidence_level ?? "NEEDS_REVIEW") as ConfidenceLevel;
        byConfidence.set(lvl, (byConfidence.get(lvl) ?? 0) + 1);
      }
      if (row.model_id) {
        byModel.set(row.model_id, (byModel.get(row.model_id) ?? 0) + 1);
      }
      const lang = row.language ?? "en";
      byLanguage.set(lang, (byLanguage.get(lang) ?? 0) + 1);
    }

    const perDay = Array.from(perDayMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, bucket]) => ({
        date,
        analyses: bucket.analyses,
        chats: bucket.chats,
      }));

    const feedback: { up: number; down: number; recent: FeedbackComment[] } = {
      up: 0,
      down: 0,
      recent: [],
    };
    for (const row of feedbackRows.data ?? []) {
      if (row.rating === 1) feedback.up += 1;
      else if (row.rating === -1) feedback.down += 1;
    }
    feedback.recent = (feedbackRows.data ?? [])
      .filter((r) => r.comment && r.comment.trim().length > 0)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
      }));

    const body: AdminStatsResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      totals,
      perDay,
      byConfidence: Array.from(byConfidence.entries()).map(([level, count]) => ({
        level,
        count,
      })),
      byModel: Array.from(byModel.entries()).map(([modelId, count]) => ({
        modelId,
        count,
      })),
      byLanguage: Array.from(byLanguage.entries()).map(([language, count]) => ({
        language,
        count,
      })),
      feedback,
    };

    return NextResponse.json(body);
  } catch (err) {
    logger.error("[admin/stats] unexpected error", err);
    return jsonError(500, "Could not load admin stats.", "DB_READ");
  }
}
