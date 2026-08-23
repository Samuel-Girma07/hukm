/**
 * Unit tests for lib/parser.ts — the never-throws LLM response parser.
 *
 * These pin down the contract the whole analyze/chat pipeline depends on:
 * whatever string comes back from the model, parseAnalysisResponse()
 * returns a structurally complete AnalysisResult without throwing.
 */

import { describe, expect, it } from "vitest";

import { parseAnalysisResponse } from "../parser";
import type { AnalysisResult } from "../types";

const FULL_JSON = JSON.stringify({
  step1FactIdentification: "The accused took a phone.",
  step2LegalClassification: "Theft under Art. 649.",
  step3ElementsAnalysis: "Taking, movable property, intent.",
  step4DefensesAndMitigation: "None raised.",
  step5SentencingFramework: "Up to 3 years imprisonment.",
  step6PrecedentApplication: "Consistent with prior decisions.",
  step7Conclusion: "Guilty of simple theft.",
  estimatedPunishment: "1-2 years",
  confidenceLevel: "HIGH",
  confidenceReason: "Strong statutory match.",
  proceduralRoadmap: "Police report → prosecution.",
  disclaimer: "Not legal advice.",
});

function expectCompleteShape(r: AnalysisResult): void {
  expect(typeof r.step1FactIdentification).toBe("string");
  expect(typeof r.step7Conclusion).toBe("string");
  expect(typeof r.rawResponse).toBe("string");
  expect(["HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"]).toContain(
    r.confidenceLevel,
  );
}

describe("parseAnalysisResponse", () => {
  it("parses a clean JSON object into every field", () => {
    const r = parseAnalysisResponse(FULL_JSON);
    expectCompleteShape(r);
    expect(r.confidenceLevel).toBe("HIGH");
    expect(r.step2LegalClassification).toBe("Theft under Art. 649.");
    expect(r.isCivilMatter).toBe(false);
  });

  it("parses JSON wrapped in ```json code fences", () => {
    const r = parseAnalysisResponse("```json\n" + FULL_JSON + "\n```");
    expect(r.confidenceLevel).toBe("HIGH");
    expect(r.step1FactIdentification).toBe("The accused took a phone.");
  });

  it("parses JSON embedded in surrounding prose", () => {
    const r = parseAnalysisResponse(
      "Here is the analysis:\n" + FULL_JSON + "\nHope this helps!",
    );
    expect(r.confidenceLevel).toBe("HIGH");
  });

  it("extracts SUGGESTIONS line into suggestedFollowUps (max 3)", () => {
    const raw =
      FULL_JSON +
      "\nSUGGESTIONS: Was the door locked? | Any prior convictions? | Was he intoxicated? | Extra ignored";
    const r = parseAnalysisResponse(raw);
    expect(r.suggestedFollowUps).toHaveLength(3);
    expect(r.suggestedFollowUps![0]).toBe("Was the door locked?");
  });

  it("prefers JSON suggestedFollowUps over the SUGGESTIONS line", () => {
    const raw = JSON.stringify({
      ...JSON.parse(FULL_JSON),
      suggestedFollowUps: ["From JSON"],
    });
    const r = parseAnalysisResponse(raw + "\nSUGGESTIONS: From marker line");
    expect(r.suggestedFollowUps).toEqual(["From JSON"]);
  });

  it("returns NEEDS_REVIEW failure result on empty input — without throwing", () => {
    const r = parseAnalysisResponse("");
    expectCompleteShape(r);
    expect(r.confidenceLevel).toBe("NEEDS_REVIEW");
    expect(r.rawResponse).toBe("");
  });

  it("returns NEEDS_REVIEW when there is no JSON at all", () => {
    const raw = "The court would likely find theft, but I am not sure.";
    const r = parseAnalysisResponse(raw);
    expectCompleteShape(r);
    expect(r.confidenceLevel).toBe("NEEDS_REVIEW");
    expect(r.rawResponse).toBe(raw);
  });

  it("returns NEEDS_REVIEW on malformed JSON", () => {
    const r = parseAnalysisResponse('{"step1FactIdentification": "oops');
    expectCompleteShape(r);
    expect(r.confidenceLevel).toBe("NEEDS_REVIEW");
  });

  it("rejects a JSON root that is an array", () => {
    const r = parseAnalysisResponse('["not","an","object"]');
    expect(r.confidenceLevel).toBe("NEEDS_REVIEW");
  });

  it("normalises loose confidence spellings from the model", () => {
    for (const [input, expected] of [
      ["high", "HIGH"],
      ["MED", "MEDIUM"],
      ["mid", "MEDIUM"],
      ["LO", "LOW"],
      ["CERTAIN", "NEEDS_REVIEW"],
      [42, "NEEDS_REVIEW"],
    ] as Array<[unknown, string]>) {
      const obj = JSON.parse(FULL_JSON);
      obj.confidenceLevel = input;
      const r = parseAnalysisResponse(JSON.stringify(obj));
      expect(r.confidenceLevel).toBe(expected);
    }
  });

  it("fills safe fallbacks for missing fields but keeps model confidence", () => {
    const obj = JSON.parse(FULL_JSON) as Record<string, unknown>;
    delete obj.disclaimer; // exactly 1 of 11 required fields missing
    const r = parseAnalysisResponse(JSON.stringify(obj));
    expect(r.confidenceLevel).toBe("HIGH"); // model confidence preserved
    expect(r.disclaimer).toContain("AI-generated");
    expect(r.estimatedPunishment).toBe("1-2 years");
  });

  it("downgrades to NEEDS_REVIEW when half the required fields are missing", () => {
    const r = parseAnalysisResponse("{}");
    expect(r.confidenceLevel).toBe("NEEDS_REVIEW");
    expect(r.confidenceReason).toContain("required fields");
  });

  it("ignores non-string entries in clarifyingQuestions", () => {
    const obj = JSON.parse(FULL_JSON);
    obj.clarifyingQuestions = ["Valid question", 42, "", null];
    const r = parseAnalysisResponse(JSON.stringify(obj));
    expect(r.clarifyingQuestions).toEqual(["Valid question"]);
  });
});
