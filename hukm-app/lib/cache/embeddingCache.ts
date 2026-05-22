/**
 * HUKM — Embedding cache.
 *
 * Reads/writes against the `cached_embeddings` table. Both functions
 * NEVER throw — if the table is missing or Supabase errors, they
 * resolve to `null` (read) or `false` (write) and the caller falls
 * back to calling NVIDIA directly.
 *
 * Hashing: see `hashEmbeddingInput` in lib/hash.ts. The cache key is a
 * SHA-256 of the trimmed input string, NOT the full text — keeping
 * keys bounded to 64 hex characters keeps the unique index efficient.
 */

import "server-only";

import { logger } from "../logger";
import { getServerClient } from "../supabase";

interface EmbeddingRow {
  embedding: number[] | null;
}

export async function getCachedEmbedding(
  inputHash: string,
): Promise<number[] | null> {
  if (!inputHash) return null;
  try {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from("cached_embeddings")
      .select("embedding")
      .eq("input_hash", inputHash)
      .maybeSingle<EmbeddingRow>();
    if (error) {
      logger.debug("[cache/embedding] read error (ignored)", {
        message: error.message,
        code: error.code,
      });
      return null;
    }
    if (!data || !Array.isArray(data.embedding)) return null;
    return data.embedding;
  } catch (err) {
    logger.debug("[cache/embedding] read threw (ignored)", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function setCachedEmbedding(
  inputHash: string,
  embedding: number[],
): Promise<boolean> {
  if (!inputHash || !Array.isArray(embedding) || embedding.length === 0) {
    return false;
  }
  try {
    const supabase = getServerClient();
    const { error } = await supabase.from("cached_embeddings").upsert(
      {
        input_hash: inputHash,
        embedding,
      },
      { onConflict: "input_hash", ignoreDuplicates: true },
    );
    if (error) {
      logger.debug("[cache/embedding] write error (ignored)", {
        message: error.message,
        code: error.code,
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.debug("[cache/embedding] write threw (ignored)", {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Returns the row count of `cached_embeddings`. Used by the admin
 * cache-stats endpoint. Returns 0 on any failure.
 */
export async function countCachedEmbeddings(): Promise<number> {
  try {
    const supabase = getServerClient();
    const { count, error } = await supabase
      .from("cached_embeddings")
      .select("id", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
