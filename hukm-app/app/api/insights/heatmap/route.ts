/**
 * GET /api/insights/heatmap
 *
 * Returns the top 20 cited articles, computed from `article_access_log`
 * via the `get_article_heatmap` SQL function. Cached for 1 hour via
 * Next.js `revalidate`.
 */

import { NextResponse } from "next/server";

import { describeDbError } from "@/lib/dbErrors";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getServerClient } from "@/lib/supabase";
import type { ArticleHeatmapRow } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 3600;

interface HeatmapRpcRow {
  article_reference: string;
  document_name: string;
  access_count: number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getServerClient();
    const { data, error } = await supabase.rpc("get_article_heatmap", {
      p_limit: 20,
    });
    if (error) {
      logger.error("[insights/heatmap] RPC failed", {
        error: error.message,
        code: error.code,
      });
      const described = describeDbError(
        error,
        "Could not load article heatmap.",
        "DB_READ",
      );
      return jsonError(described.status, described.error, described.code);
    }
    const rows = (data as HeatmapRpcRow[] | null) ?? [];
    const total = rows.reduce((sum, r) => sum + Number(r.access_count ?? 0), 0);
    const enriched: ArticleHeatmapRow[] = rows.map((row) => ({
      article_reference: row.article_reference,
      document_name: row.document_name,
      access_count: Number(row.access_count),
      percentage: total > 0 ? (Number(row.access_count) / total) * 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      total,
      rows: enriched,
    });
  } catch (err) {
    logger.error("[insights/heatmap] unexpected error", err);
    return jsonError(500, "Could not load article heatmap.", "DB_READ");
  }
}
