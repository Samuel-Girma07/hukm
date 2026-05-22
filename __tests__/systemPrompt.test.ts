import { describe, it, expect } from "vitest";
import {
  buildPromptWithContext,
  buildAnalysisPrompt,
  buildChatPrompt,
  BASE_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
} from "../lib/systemPrompt";
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

describe("buildPromptWithContext", () => {
  it("includes the base system prompt", () => {
    const result = buildPromptWithContext([]);
    expect(result).toContain(BASE_SYSTEM_PROMPT);
  });

  it("handles empty chunks gracefully", () => {
    const result = buildPromptWithContext([]);
    expect(result).toContain("No law articles were retrieved");
  });

  it("includes chunk content when chunks are provided", () => {
    const chunks = [makeChunk()];
    const result = buildPromptWithContext(chunks);
    expect(result).toContain("Article 525 — Simple Theft");
    expect(result).toContain("Whoever commits theft shall be punished");
  });

  it("includes document name for each chunk", () => {
    const chunks = [makeChunk({ documentName: "constitution-1995" })];
    const result = buildPromptWithContext(chunks);
    expect(result).toContain("constitution-1995");
  });

  it("includes similarity scores", () => {
    const chunks = [makeChunk({ similarity: 0.92 })];
    const result = buildPromptWithContext(chunks);
    expect(result).toContain("92.0%");
  });

  it("numbers multiple chunks correctly", () => {
    const chunks = [
      makeChunk({ id: 1, articleReference: "Article 1" }),
      makeChunk({ id: 2, articleReference: "Article 2" }),
      makeChunk({ id: 3, articleReference: "Article 3" }),
    ];
    const result = buildPromptWithContext(chunks);
    expect(result).toContain("Source 1:");
    expect(result).toContain("Source 2:");
    expect(result).toContain("Source 3:");
    expect(result).toContain("3 law article(s)");
  });

  it("includes end marker when chunks present", () => {
    const chunks = [makeChunk()];
    const result = buildPromptWithContext(chunks);
    expect(result).toContain("END OF RETRIEVED LAW ARTICLES");
  });
});

describe("buildAnalysisPrompt", () => {
  it("uses the BASE_SYSTEM_PROMPT and demands JSON output", () => {
    const result = buildAnalysisPrompt([]);
    expect(result).toContain(BASE_SYSTEM_PROMPT);
    expect(result).toContain("ONLY valid JSON");
  });

  it("injects retrieved chunks the same way the legacy alias does", () => {
    const chunks = [makeChunk({ articleReference: "Article 525 — Theft" })];
    expect(buildAnalysisPrompt(chunks)).toEqual(buildPromptWithContext(chunks));
  });
});

describe("buildChatPrompt", () => {
  it("uses CHAT_SYSTEM_PROMPT, never demands JSON", () => {
    const result = buildChatPrompt([]);
    expect(result).toContain(CHAT_SYSTEM_PROMPT);
    expect(result).not.toContain("ONLY valid JSON");
    expect(result).toContain("Do NOT output JSON");
  });

  it("forbids 7-step structured analyses unless requested", () => {
    const result = buildChatPrompt([]);
    expect(result).toMatch(/Never produce 7-step structured/i);
  });

  it("differs from the analysis prompt", () => {
    const chunks = [makeChunk()];
    const a = buildAnalysisPrompt(chunks);
    const c = buildChatPrompt(chunks);
    expect(a).not.toEqual(c);
  });

  it("still injects the law-context block when chunks are present", () => {
    const chunks = [makeChunk({ articleReference: "Article 525" })];
    const result = buildChatPrompt(chunks);
    expect(result).toContain("Article 525");
    expect(result).toContain("RETRIEVED LAW ARTICLES");
    expect(result).toContain("END OF RETRIEVED LAW ARTICLES");
  });

  it("notes empty retrieval when chunks is empty", () => {
    const result = buildChatPrompt([]);
    expect(result).toContain("No law articles were retrieved");
  });
});
