/**
 * GET /api/articles/heatmap
 *
 * Returns the most frequently accessed articles based on article_access_log.
 * Used for the admin dashboard to show which legal provisions are most queried.
 *
 * Uses the `get_article_heatmap(p_limit)` Postgres RPC for aggregation
 * instead of fetching up to 10k rows and aggregating in memory with a Map.
 * The SQL GROUP BY is faster and uses less memory than the JS equivalent.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { checkEndpointRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { getServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeatmapRpcRow {
  article_reference: string;
  document_name: string;
  access_count: number;
}

const TOP_N = 50;

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  // Rate-limit by IP. This endpoint is public and returns aggregate data —
  // 30/min/IP is enough for the admin dashboard refresh pattern.
  const rateLimit = await checkEndpointRateLimit(request, {
    endpoint: "articles-heatmap",
    max: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return jsonError(
      429,
      `Rate limit exceeded. Retry after ${rateLimit.retryAfterSeconds} seconds.`,
      "RATE_LIMIT",
      rateLimitHeaders(rateLimit),
    );
  }

  const supabase = getServerClient();

  try {
    // Use the SQL RPC for aggregation — much faster than fetching 10k rows
    // and aggregating in memory.
    const { data, error } = await supabase.rpc("get_article_heatmap", {
      p_limit: TOP_N,
    });

    if (error) {
      logger.error("[articles/heatmap] RPC failed", {
        error: error.message,
        code: error.code,
      });
      return jsonError(500, "Could not load article heatmap.", "DB_READ");
    }

    const rows = (data as HeatmapRpcRow[] | null) ?? [];
    const maxCount = rows[0]?.access_count ?? 1;

    const heatmap = rows.map((row) => ({
      article_reference: row.article_reference,
      document_name: row.document_name,
      access_count: row.access_count,
      percentage: maxCount > 0 ? Math.round((row.access_count / maxCount) * 100) : 0,
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
