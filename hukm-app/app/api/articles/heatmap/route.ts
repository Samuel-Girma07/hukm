/**
 * GET /api/articles/heatmap
 *
 * Returns the most frequently accessed articles based on article_access_log.
 * Used for the admin dashboard to show which legal provisions are most queried.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeatmapRow {
  article_reference: string;
  document_name: string;
  access_count: number;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const supabase = getServerClient();

  try {
    // Aggregate access counts by article
    const { data, error } = await supabase
      .from("article_access_log")
      .select("article_reference, document_name")
      .limit(10000); // Safety limit

    if (error) {
      logger.error("[articles/heatmap] query failed", {
        error: error.message,
        code: error.code,
      });
      return jsonError(500, "Could not load article heatmap.", "DB_READ");
    }

    // Aggregate in memory (more efficient than GROUP BY for now)
    const counts = new Map<string, { article_reference: string; document_name: string; count: number }>();
    
    for (const row of data ?? []) {
      const key = `${row.document_name}::${row.article_reference}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          article_reference: row.article_reference,
          document_name: row.document_name,
          count: 1,
        });
      }
    }

    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    const maxCount = sorted[0]?.count ?? 1;

    const heatmap = sorted.map((row) => ({
      article_reference: row.article_reference,
      document_name: row.document_name,
      access_count: row.count,
      percentage: maxCount > 0 ? Math.round((row.count / maxCount) * 100) : 0,
    }));

    return NextResponse.json({
      success: true,
      data: heatmap,
    });
  } catch (err) {
    logger.error("[articles/heatmap] unexpected error", err);
    return jsonError(500, "Could not load article heatmap.", "DB_READ");
  }
}
