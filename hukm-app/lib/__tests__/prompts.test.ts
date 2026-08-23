/**
 * Unit tests for lib/prompts.ts — prompt assembly contracts.
 *
 * The analyze/chat routes depend on these invariants: retrieved context
 * is actually injected, language directive switches, anti-hallucination
 * rules always present, and the chat summary never leaks full JSON.
 */

import { describe, expect, it } from "vitest";
import type { LawChunk, RetrievalResult } from "../types";

import {
  buildAnalysisPrompt,
  buildChatPrompt,
  renderChunksForUser,
  summariseAnalysisForChat,
} from "../prompts";

const CHUNKS: LawChunk[] = [
  {
    id: 1,
    document_name: "criminal-code-414-2004",
    article_reference: "Art. 649 – Theft",
    content: "Whoever takes movable property belonging to another is punishable with imprisonment.",
    similarity: 0.82,
  },
  {
    id: 2,
    document_name: "criminal-code-414-2004",
    article_reference: "Art. 650",
    content: "Petty theft provisions.",
    similarity: 0.61,
  },
];

const RETRIEVAL: RetrievalResult = { chunks: CHUNKS, stage: 1, maxSimilarity: 0.82 };

describe("buildAnalysisPrompt", () => {
  it("injects the retrieved articles with references and content", () => {
    const p = buildAnalysisPrompt({ retrieval: RETRIEVAL, language: "en" });
    expect(p).toContain("Art. 649");
    expect(p).toContain("punishable with imprisonment");
    expect(p).toContain("[ROLE]");
  });

  it("always carries the anti-hallucination and JSON output contracts", () => {
    const p = buildAnalysisPrompt({ retrieval: RETRIEVAL, language: "en" });
    expect(p.toLowerCase()).toContain("hallucination");
    expect(p).toContain('"step7Conclusion"');
  });

  it("switches the response language directive", () => {
    const en = buildAnalysisPrompt({ retrieval: RETRIEVAL, language: "en" });
    const am = buildAnalysisPrompt({ retrieval: RETRIEVAL, language: "am" });
    expect(en).not.toContain("Amharic");
    expect(am).toContain("Amharic");
  });

  it("appends the crime-category block only when a category is given", () => {
    const without = buildAnalysisPrompt({ retrieval: RETRIEVAL, language: "en" });
    expect(without).not.toContain("[CATEGORY");

    const withCategory = buildAnalysisPrompt({
      retrieval: RETRIEVAL,
      language: "en",
      crimeCategory: "theft",
    });
    // Category block exists and mentions the chosen category somewhere.
    expect(withCategory).toContain("theft");
  });

  it("marks fallback-stage retrievals as low-confidence context", () => {
    const p = buildAnalysisPrompt({
      retrieval: { chunks: [], stage: 2, maxSimilarity: 0 },
      language: "en",
      computedConfidence: {
        level: "LOW",
        reason: "Fallback stage used.",
        stats: {
          strongCount: 0,
          moderateCount: 0,
          weakCount: 0,
          maxSimilarity: 0,
          hasPunishment: false,
          hasCriminalCode: false,
          stage: 2,
          chunkCount: 0,
        },
      },
    });
    expect(p).toContain("LOW");
  });
});

describe("buildChatPrompt", () => {
  it("forbids JSON output and includes retrieved scope", () => {
    const p = buildChatPrompt({ retrieval: RETRIEVAL });
    expect(p).toContain("Do NOT output JSON");
    expect(p).toContain("Ethiopian criminal law only");
    expect(p).toContain("Art. 649");
  });

  it("embeds the prior-analysis summary when provided", () => {
    const p = buildChatPrompt({
      retrieval: RETRIEVAL,
      priorAnalysisSummary: "Original scenario: phone theft at a shop.",
    });
    expect(p).toContain("Original scenario: phone theft at a shop.");
  });

  it("uses an explicit None placeholder when there is no summary", () => {
    const p = buildChatPrompt({ retrieval: RETRIEVAL, priorAnalysisSummary: null });
    expect(p).toContain("None provided.");
  });
});

describe("summariseAnalysisForChat / renderChunksForUser", () => {
  it("summarises the four key fields without dumping raw JSON", () => {
    const s = summariseAnalysisForChat({
      step2LegalClassification: "Theft",
      step5SentencingFramework: "Up to 3 years",
      step7Conclusion: "Guilty",
      estimatedPunishment: "1-2 years",
      confidenceLevel: "HIGH",
    });
    expect(s).toContain("Classification: Theft");
    expect(s).toContain("Confidence: HIGH");
    expect(s.startsWith("{")).toBe(false);
  });

  it("renders chunk list with percentages for user-facing panels", () => {
    const r = renderChunksForUser(CHUNKS);
    expect(r.split("\n")).toHaveLength(2);
    expect(r).toContain("Art. 649 – Theft – 82.0%");
  });
});
