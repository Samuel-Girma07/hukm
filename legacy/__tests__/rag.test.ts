import { describe, it, expect } from "vitest";
import {
  deduplicateChunks,
  calculateTextSimilarity,
} from "../lib/rag";
import type { LawChunk } from "../lib/types";

function makeChunk(overrides: Partial<LawChunk> = {}): LawChunk {
  return {
    id: 1,
    documentName: "criminal-code-414-2004",
    articleReference: "Article 525 — Simple Theft",
    content: "Whoever commits theft shall be punished with simple imprisonment.",
    metadata: {},
    similarity: 0.85,
    ...overrides,
  };
}

describe("calculateTextSimilarity", () => {
  it("returns 1 for identical text", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    expect(calculateTextSimilarity(text, text)).toBe(1);
  });

  it("returns 0 for completely different text (no shared words >2 chars)", () => {
    const a = "alpha beta gamma";
    const b = "delta epsilon zeta";
    expect(calculateTextSimilarity(a, b)).toBe(0);
  });

  it("returns 0 when both texts are empty", () => {
    expect(calculateTextSimilarity("", "")).toBe(0);
  });

  it("ignores short words (<= 2 characters)", () => {
    // After filtering 'is'/'a': a -> {theft, crime}, b -> {theft, bad}.
    // Intersection={theft}=1, union={theft, crime, bad}=3, so 1/3.
    const a = "Theft is a crime";
    const b = "Theft is bad";
    expect(calculateTextSimilarity(a, b)).toBeCloseTo(1 / 3, 5);
  });

  it("normalizes case and punctuation", () => {
    const a = "Article 525, Simple Theft.";
    const b = "ARTICLE 525 simple theft";
    expect(calculateTextSimilarity(a, b)).toBe(1);
  });

  it("returns a fractional score for partial overlap", () => {
    const a = "robbery violence shop nighttime";
    const b = "robbery shop daytime entry";
    const score = calculateTextSimilarity(a, b);
    // intersection: {robbery, shop} = 2; union has 6 unique words
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(0.5);
  });
});

describe("deduplicateChunks", () => {
  it("returns the input unchanged when 0 or 1 chunks are provided", () => {
    expect(deduplicateChunks([])).toEqual([]);
    const single = [makeChunk()];
    expect(deduplicateChunks(single)).toEqual(single);
  });

  it("removes duplicates with identical content", () => {
    const chunks = [
      makeChunk({ id: 1, content: "Identical text content for theft." }),
      makeChunk({ id: 2, content: "Identical text content for theft." }),
      makeChunk({ id: 3, content: "Identical text content for theft." }),
    ];
    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("keeps chunks below the similarity threshold", () => {
    const chunks = [
      makeChunk({
        id: 1,
        content: "Article 525: simple theft definition with property elements.",
      }),
      makeChunk({
        id: 2,
        content:
          "Article 638: armed robbery requires violence and weapon possession.",
      }),
    ];
    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(2);
  });

  it("respects a custom threshold (lower threshold removes more)", () => {
    const chunks = [
      makeChunk({
        id: 1,
        content: "Theft is taking property unlawfully without consent.",
      }),
      makeChunk({
        id: 2,
        content: "Theft is taking property without permission unlawfully.",
      }),
    ];
    // High threshold (0.95) -> both kept (slightly different wording)
    expect(deduplicateChunks(chunks, 0.95)).toHaveLength(2);
    // Lower threshold (0.5) -> the second is removed as duplicate
    expect(deduplicateChunks(chunks, 0.5)).toHaveLength(1);
  });

  it("preserves the first occurrence and drops later duplicates", () => {
    const chunks = [
      makeChunk({ id: 100, content: "First version of an article text." }),
      makeChunk({ id: 200, content: "First version of an article text." }),
    ];
    const result = deduplicateChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(100);
  });
});
