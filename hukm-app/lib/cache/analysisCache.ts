/**
 * HUKM — Analysis cache.
 *
 * Reads/writes against the `cached_analyses` table. The cache stores
 * a *pointer* (result_id) into `analysis_results`, not a copy of the
 * data. That means a cache hit triggers one extra Supabase read to
 * dereference the analysis row, but it also means cache invalidation
 * flows naturally from the existing ON DELETE CASCADE on
 * analysis_results.
 *
 * Cache key: the caller passes a `cacheKey` that should include BOTH
 * the scenario hash AND the session id (see app/api/analyze/route.ts).
 * This prevents the cross-user leak where user B submitting the same
 * scenario text as user A would receive user A's resultId — which they
 * couldn't access (ownership check returns 404) but which leaked the
 * fact that user A had run the same scenario.
 *
 * TTL is 7 days by default — old hits expire so the cache doesn't
 * pin a stale model output forever.
 */

import "server-only";

import { logger } from "../logger";
import { getServerClient } from "../supabase";
import type { PersistedAnalysis } from "../types";

const DEFAULT_TTL_DAYS = 7;

interface CachedAnalysisRow {
  result_id: string;
  created_at: string;
}

export interface CachedAnalysisHit {
  resultId: string;
  analysis: PersistedAnalysis;
}

export async function getCachedAnalysis(
  cacheKey: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<CachedAnalysisHit | null> {
  if (!cacheKey) return null;
  try {
    const supabase = getServerClient();
    const { data: cached, error } = await supabase
      .from("cached_analyses")
      .select("result_id, created_at")
      .eq("scenario_hash", cacheKey)
      .maybeSingle<CachedAnalysisRow>();

    if (error || !cached) {
      if (error) {
        logger.debug("[cache/analysis] read error (ignored)", {
          message: error.message,
          code: error.code,
        });
      }
      return null;
    }

    // TTL check.
    const created = new Date(cached.created_at).getTime();
    if (Number.isFinite(created)) {
      const ageMs = Date.now() - created;
      if (ageMs > ttlDays * 24 * 60 * 60 * 1000) {
        // Stale; opportunistically delete and miss.
        await supabase
          .from("cached_analyses")
          .delete()
          .eq("scenario_hash", cacheKey);
        return null;
      }
    }

    // Dereference the analysis_result row.
    const { data: analysisRow, error: analysisError } = await supabase
      .from("analysis_results")
      .select("id, session_id, scenario_input, result, model_id, created_at")
      .eq("id", cached.result_id)
      .maybeSingle<PersistedAnalysis>();

    if (analysisError || !analysisRow) {
      // Pointer is dangling — drop the cache row.
      await supabase
        .from("cached_analyses")
        .delete()
        .eq("scenario_hash", cacheKey);
      return null;
    }

    return { resultId: analysisRow.id, analysis: analysisRow };
  } catch (err) {
    logger.debug("[cache/analysis] read threw (ignored)", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function setCachedAnalysis(
  cacheKey: string,
  resultId: string,
): Promise<boolean> {
  if (!cacheKey || !resultId) return false;
  try {
    const supabase = getServerClient();
    const { error } = await supabase.from("cached_analyses").upsert(
      {
        scenario_hash: cacheKey,
        result_id: resultId,
      },
      { onConflict: "scenario_hash", ignoreDuplicates: false },
    );
    if (error) {
      logger.debug("[cache/analysis] write error (ignored)", {
        message: error.message,
        code: error.code,
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.debug("[cache/analysis] write threw (ignored)", {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function countCachedAnalyses(): Promise<number> {
  try {
    const supabase = getServerClient();
    const { count, error } = await supabase
      .from("cached_analyses")
      .select("id", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
