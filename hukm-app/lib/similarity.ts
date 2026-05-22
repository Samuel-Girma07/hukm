/**
 * HUKM — Text-similarity utilities used for de-duplicating retrieved chunks.
 *
 * Vector retrieval frequently surfaces near-identical chunks (the same
 * article appears under multiple `article_reference` strings, or a long
 * article was split into overlapping windows during ingestion). Showing
 * those duplicates wastes the model's context budget AND inflates the
 * "highly relevant" count in the confidence heuristic.
 *
 * We compute Jaccard similarity over a tokenised representation of each
 * chunk's content. If two chunks exceed `JACCARD_DEDUP_THRESHOLD`, we keep
 * the one with the higher retrieval similarity score.
 */

import type { LawChunk } from "./types";

/**
 * Two chunks whose Jaccard similarity exceeds this value are treated as
 * duplicates. 0.90 is conservative: cosmetic edits won't drop below it,
 * but distinct articles overlapping on common legal phrases stay.
 */
export const JACCARD_DEDUP_THRESHOLD = 0.9;

/**
 * Tokenises a string for Jaccard comparison.
 *  - Lower-cases.
 *  - Strips punctuation.
 *  - Drops words shorter than 3 characters (high-frequency stop words and
 *    article references like "1", "2", "of", "to" don't carry signal).
 */
export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  return new Set(tokens);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Removes near-duplicate chunks. The input array does NOT need to be
 * sorted; we sort internally so the highest-similarity chunk is preferred
 * when a duplicate group is found.
 */
export function deduplicateChunks(
  chunks: LawChunk[],
  threshold: number = JACCARD_DEDUP_THRESHOLD,
): LawChunk[] {
  if (chunks.length <= 1) return [...chunks];

  // Sort descending so we always anchor on the strongest match.
  const sorted = [...chunks].sort((a, b) => b.similarity - a.similarity);

  const kept: Array<{ chunk: LawChunk; tokens: Set<string> }> = [];
  for (const chunk of sorted) {
    const tokens = tokenize(chunk.content);
    let isDuplicate = false;
    for (const accepted of kept) {
      if (jaccardSimilarity(tokens, accepted.tokens) > threshold) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) kept.push({ chunk, tokens });
  }

  return kept.map((entry) => entry.chunk);
}
