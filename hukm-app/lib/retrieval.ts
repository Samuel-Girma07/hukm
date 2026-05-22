/**
 * HUKM — Two-stage retrieval pipeline with citation chaining.
 *
 *   Stage 1: match_law_chunks(embedding, threshold = 0.3, count = 8)
 *   Stage 2: if Stage 1 returns 0 rows, retry with threshold = 0.0
 *   Stage 3: expand retrieved chunks via citation chaining (fetch
 *            articles they cross-reference)
 *
 * The stage that produced the chunks is recorded in the returned
 * `RetrievalResult` so the prompt builder can downgrade confidence
 * appropriately for fallback retrievals.
 *
 * Embedding goes through `embedCached` so repeated identical scenarios
 * (or shared prefixes after our hash normalisation) skip the NVIDIA
 * call entirely.
 */

import "server-only";

import { embedCached } from "./embeddings";
import { logger } from "./logger";
import { addBreadcrumb } from "./sentry";
import { deduplicateChunks } from "./similarity";
import { getServerClient } from "./supabase";
import { expandWithCitations } from "./citations";
import type { LawChunk, RetrievalResult } from "./types";

const STAGE_ONE_THRESHOLD = 0.3;
const STAGE_TWO_THRESHOLD = 0.0;
const MATCH_COUNT = 8;

interface MatchRow {
  id: number;
  document_name: string;
  article_reference: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
}

function rowsToChunks(rows: MatchRow[]): LawChunk[] {
  return rows.map((row) => ({
    id: row.id,
    document_name: row.document_name,
    article_reference: row.article_reference ?? "Unknown article",
    content: row.content,
    similarity: row.similarity,
  }));
}

async function callMatchRpc(
  embedding: number[],
  threshold: number,
): Promise<MatchRow[]> {
  const supabase = getServerClient();
  const { data, error } = await supabase.rpc("match_law_chunks", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: MATCH_COUNT,
  });
  if (error) {
    logger.error("[retrieval] match_law_chunks RPC failed", {
      message: error.message,
      code: error.code,
      hint: error.hint,
      threshold,
    });
    return [];
  }
  return (data as MatchRow[] | null) ?? [];
}

export interface RetrieveContextResult extends RetrievalResult {
  /** True when the embedding step was served from cache. */
  embeddingCacheHit: boolean;
}

/**
 * Embeds the query (cache-aware), runs the two-stage retrieval, then
 * expands the results via citation chaining. Always returns a
 * `RetrieveContextResult` (possibly with chunks: [] if even Stage 2
 * finds nothing). Never throws.
 */
export async function retrieveContext(
  query: string,
): Promise<RetrieveContextResult> {
  let embedding: number[];
  let embeddingCacheHit = false;
  try {
    const r = await embedCached(query, "query");
    embedding = r.embedding;
    embeddingCacheHit = r.cacheHit;
  } catch (err) {
    logger.error("[retrieval] embedding failed", err);
    return {
      chunks: [],
      stage: 2,
      maxSimilarity: 0,
      embeddingCacheHit: false,
    };
  }

  // Stage 1: primary retrieval
  const stageOne = await callMatchRpc(embedding, STAGE_ONE_THRESHOLD);
  if (stageOne.length > 0) {
    const primaryChunks = deduplicateChunks(rowsToChunks(stageOne));
    const max = primaryChunks.reduce(
      (m, c) => (c.similarity > m ? c.similarity : m),
      0,
    );

    // Citation chaining: fetch articles referenced by primary results
    const expanded = await expandWithCitations(primaryChunks);
    const finalChunks = expanded.all;

    logger.info("[retrieval] stage 1 succeeded", {
      retrieved: stageOne.length,
      kept: primaryChunks.length,
      expanded: expanded.expanded.length,
      final: finalChunks.length,
      maxSimilarity: max,
      embeddingCacheHit,
    });

    return {
      chunks: finalChunks,
      stage: 1,
      maxSimilarity: max,
      embeddingCacheHit,
      expandedCount: expanded.expanded.length,
    };
  }

  // Stage 2: fallback retrieval
  addBreadcrumb("retrieval", "stage 1 returned 0 rows; falling back");
  logger.warn("[retrieval] stage 1 returned 0 rows; falling through to stage 2");

  const stageTwo = await callMatchRpc(embedding, STAGE_TWO_THRESHOLD);
  if (stageTwo.length === 0) {
    logger.warn("[retrieval] stage 2 also returned 0 rows");
    return {
      chunks: [],
      stage: 2,
      maxSimilarity: 0,
      embeddingCacheHit,
    };
  }

  const primaryChunks = deduplicateChunks(rowsToChunks(stageTwo));
  const max = primaryChunks.reduce(
    (m, c) => (c.similarity > m ? c.similarity : m),
    0,
  );

  // Even in fallback, try citation expansion — it might help
  const expanded = await expandWithCitations(primaryChunks);
  const finalChunks = expanded.all;

  logger.info("[retrieval] stage 2 returned chunks", {
    retrieved: stageTwo.length,
    kept: primaryChunks.length,
    expanded: expanded.expanded.length,
    final: finalChunks.length,
    maxSimilarity: max,
    embeddingCacheHit,
  });

  return {
    chunks: finalChunks,
    stage: 2,
    maxSimilarity: max,
    embeddingCacheHit,
    expandedCount: expanded.expanded.length,
  };
}

/**
 * Convenience for callers that only need the chunks array.
 */
export async function retrieveChunks(query: string): Promise<LawChunk[]> {
  const { chunks } = await retrieveContext(query);
  return chunks;
}
