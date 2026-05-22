/**
 * HUKM — NVIDIA embeddings client (with optional cache).
 *
 * `embed()` calls the NVIDIA `/v1/embeddings` endpoint and L2-normalises
 * the returned vector before handing it to pgvector.
 *
 * `embedCached()` checks `cached_embeddings` first and writes the result
 * back on a miss. The cache layer never throws — on Supabase failure we
 * fall through to a direct NVIDIA call, so caching is transparently
 * optional.
 */

import "server-only";

import {
  getCachedEmbedding,
  setCachedEmbedding,
} from "./cache/embeddingCache";
import { env } from "./env";
import { hashEmbeddingInput } from "./hash";
import { logger } from "./logger";
import { EMBEDDING } from "./models";

interface EmbeddingApiResponse {
  data?: Array<{
    embedding?: number[];
  }>;
}

export type EmbeddingInputType = "query" | "passage";

/**
 * Embeds a single text. Returns a 1024-dim L2-normalised vector.
 */
export async function embed(
  text: string,
  inputType: EmbeddingInputType = "query",
): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("[hukm/embeddings] Cannot embed empty text");
  }

  const body = {
    input: [trimmed],
    model: EMBEDDING.modelId,
    input_type: inputType,
  };

  const response = await fetch(EMBEDDING.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.error("[embeddings] NVIDIA API returned non-2xx", {
      status: response.status,
      body: text.slice(0, 300),
    });
    throw new Error(
      `NVIDIA embeddings API error (HTTP ${response.status}): ${text || "no body"}`,
    );
  }

  const data = (await response.json()) as EmbeddingApiResponse;
  const vector = data.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error(
      "[hukm/embeddings] NVIDIA response did not contain an embedding array",
    );
  }

  if (vector.length !== EMBEDDING.dimensions) {
    throw new Error(
      `[hukm/embeddings] Expected ${EMBEDDING.dimensions}-dim vector, got ${vector.length}`,
    );
  }

  return l2Normalise(vector);
}

/**
 * Cache-aware embed. Returns the same shape as `embed()`, plus a flag
 * indicating whether the result came from the cache.
 */
export interface EmbedCachedResult {
  embedding: number[];
  cacheHit: boolean;
}

export async function embedCached(
  text: string,
  inputType: EmbeddingInputType = "query",
): Promise<EmbedCachedResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("[hukm/embeddings] Cannot embed empty text");
  }

  const hash = hashEmbeddingInput(trimmed);
  const cached = await getCachedEmbedding(hash);
  if (cached) {
    return { embedding: cached, cacheHit: true };
  }

  const fresh = await embed(trimmed, inputType);
  // Fire-and-forget cache write.
  void setCachedEmbedding(hash, fresh);
  return { embedding: fresh, cacheHit: false };
}

export function l2Normalise(vector: number[]): number[] {
  let sumSquares = 0;
  for (const v of vector) sumSquares += v * v;
  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm === 0) return vector;
  return vector.map((v) => v / norm);
}
