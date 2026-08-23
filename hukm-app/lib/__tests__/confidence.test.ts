/**
 * Unit tests for lib/confidence.ts — the deterministic confidence rules.
 *
 * Pins the priority order: fallback-stage LOW → strong+punishment HIGH →
 * single-strong MEDIUM → moderate-cluster MEDIUM → weak LOW.
 */

import { describe, expect, it } from "vitest";
import type { LawChunk, RetrievalResult } from "../types";

import { computeConfidence, getCurrentThresholds } from "../confidence";

const { strong: STRONG, moderate: MODERATE } = getCurrentThresholds();

function chunk(overrides: Partial<LawChunk> & { similarity: number }): LawChunk {
  return {
    id: Math.floor(Math.random() * 1e6),
    document_name: "criminal-code-414-2004",
    article_reference: "Art. 649",
    content:
      "The offender shall be punished with imprisonment of not less than one year and a fine.",
    ...overrides,
  };
}

function retrieval(chunks: LawChunk[], stage: 1 | 2 = 1): RetrievalResult {
  const maxSimilarity = chunks.reduce((m, c) => (c.similarity > m ? c.similarity : m), 0);
  return { chunks, stage, maxSimilarity };
}

describe("computeConfidence", () => {
  it("returns LOW for empty retrieval", () => {
    const a = computeConfidence(retrieval([]));
    expect(a.level).toBe("LOW");
    expect(a.stats.chunkCount).toBe(0);
  });

  it("returns LOW whenever the fallback stage was used — even with strong matches", () => {
    const a = computeConfidence(
      retrieval([chunk({ similarity: STRONG + 0.2 })], 2),
    );
    expect(a.level).toBe("LOW");
    expect(a.stats.stage).toBe(2);
  });

  it("returns HIGH with ≥3 strong punishment-bearing Criminal Code chunks", () => {
    const chunks = [
      chunk({ similarity: STRONG + 0.1 }),
      chunk({ similarity: STRONG + 0.05 }),
      chunk({ similarity: STRONG }),
    ];
    const a = computeConfidence(retrieval(chunks));
    expect(a.level).toBe("HIGH");
    expect(a.stats.strongCount).toBe(3);
    expect(a.stats.hasCriminalCode).toBe(true);
    expect(a.stats.hasPunishment).toBe(true);
  });

  it("returns HIGH for strong matches from ANY document when punishment present", () => {
    const chunks = [
      chunk({ document_name: "anti-corruption-881-2015", similarity: STRONG + 0.1 }),
      chunk({ document_name: "drug-control", similarity: STRONG + 0.05 }),
      chunk({ document_name: "anti-terrorism", similarity: STRONG }),
    ];
    expect(computeConfidence(retrieval(chunks)).level).toBe("HIGH");
  });

  it("caps at MEDIUM for a single strong match with punishment", () => {
    const a = computeConfidence(
      retrieval([
        chunk({ similarity: STRONG }),
        chunk({ similarity: 0.2, content: "Definitions of terms." }),
      ]),
    );
    expect(a.level).toBe("MEDIUM");
    expect(a.stats.strongCount).toBe(1);
  });

  it("returns MEDIUM for ≥3 moderate matches even without punishment text", () => {
    const sim = (STRONG + MODERATE) / 2; // strictly between thresholds
    const chunks = [
      chunk({ similarity: sim, content: "Procedural guidance." }),
      chunk({ similarity: sim, content: "Scope provisions." }),
      chunk({ similarity: sim, content: "Transitional clauses." }),
    ];
    const a = computeConfidence(retrieval(chunks));
    expect(a.level).toBe("MEDIUM");
    expect(a.stats.moderateCount).toBe(3);
  });

  it("returns LOW when everything is weak", () => {
    const a = computeConfidence(
      retrieval([chunk({ similarity: 0.1 }), chunk({ similarity: 0.2 })]),
    );
    expect(a.level).toBe("LOW");
    expect(a.stats.weakCount).toBe(2);
  });

  it("always reports complete stats mirroring the input", () => {
    const chunks = [
      chunk({ similarity: STRONG + 0.01 }),
      chunk({ similarity: (STRONG + MODERATE) / 2 }),
      chunk({ similarity: 0.1 }),
    ];
    const a = computeConfidence(retrieval(chunks));
    expect(a.stats).toMatchObject({
      strongCount: 1,
      moderateCount: 1,
      weakCount: 1,
      hasPunishment: true,
      hasCriminalCode: true,
      stage: 1,
      chunkCount: 3,
    });
    expect(a.reason.length).toBeGreaterThan(10);
  });
});
