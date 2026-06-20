/**
 * GET /api/admin/cache-stats
 *
 * Returns counts and rough cost-savings estimates for the embedding +
 * analysis caches. Pricing assumption: ~$0.0001 per saved upstream call
 * (covers the embedding hit and the analysis hit at this scale).
 * Requires admin auth.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { countCachedAnalyses } from "@/lib/cache/analysisCache";
import { countCachedEmbeddings } from "@/lib/cache/embeddingCache";
import { getServerClient } from "@/lib/supabase";
import type { CacheStatsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COST_PER_REQUEST_USD = 0.0001;

export async function GET(
  request: NextRequest,
): Promise<NextResponse<CacheStatsResponse>> {
  const denied = requireAdmin(request);
  if (denied) return denied as NextResponse<CacheStatsResponse>;

  const [embeddings, analyses, cacheHitsRow] = await Promise.all([
    countCachedEmbeddings(),
    countCachedAnalyses(),
    countCacheAnalyzeHits(),
  ]);

  // Rough estimate: cached embeddings represent embedding calls saved
  // each time they're re-used, but we don't track per-key hit counts.
  // The number of analysis cache hits is observable in usage_events
  // (metadata.cache = true), so we use that for the analyses figure.
  const estimatedRequestsSaved = cacheHitsRow + embeddings;

  return NextResponse.json({
    success: true,
    cachedEmbeddings: embeddings,
    cachedAnalyses: analyses,
    estimatedRequestsSaved,
    estimatedCostSavedUsd: estimatedRequestsSaved * COST_PER_REQUEST_USD,
  });
}

async function countCacheAnalyzeHits(): Promise<number> {
  try {
    const supabase = getServerClient();
    const { count, error } = await supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "analyze")
      .filter("metadata->>cache", "eq", "true");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
