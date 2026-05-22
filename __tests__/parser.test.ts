import { describe, it, expect } from "vitest";
import { parseResponse, validateResult } from "../lib/parser";
import type { AnalysisResult } from "../lib/types";

describe("parseResponse", () => {
  it("parses valid JSON response", () => {
    const valid: Partial<AnalysisResult> = {
      step1FactIdentification: "Facts identified",
      step2LegalClassification: "Classified",
      step3ElementsAnalysis: "Elements analyzed",
      step4DefensesAndMitigation: "Defenses identified",
      step5SentencingFramework: "Framework provided",
      step6PrecedentApplication: "Precedents applied",
      step7Conclusion: "Conclusion reached",
      estimatedPunishment: "5 years",
      confidenceLevel: "HIGH",
      confidenceReason: "Strong match",
      proceduralRoadmap: "Steps outlined",
      disclaimer: "Not legal advice",
      isCivilMatter: false,
      needsClarification: false,
      rawResponse: "raw",
    };
    const result = parseResponse(JSON.stringify(valid));
    expect(result.step1FactIdentification).toBe("Facts identified");
    expect(result.confidenceLevel).toBe("HIGH");
    expect(result.isCivilMatter).toBe(false);
  });

  it("strips markdown fences before parsing", () => {
    const valid = {
      step1FactIdentification: "Facts",
      step2LegalClassification: "Class",
      step3ElementsAnalysis: "Elements",
      step4DefensesAndMitigation: "Defenses",
      step5SentencingFramework: "Framework",
      step6PrecedentApplication: "Precedents",
      step7Conclusion: "Conclusion",
      estimatedPunishment: "Fine",
      confidenceLevel: "MEDIUM",
      confidenceReason: "Reason",
      proceduralRoadmap: "Roadmap",
      disclaimer: "Disclaimer",
      isCivilMatter: false,
      needsClarification: false,
    };
    const wrapped = "```json\n" + JSON.stringify(valid) + "\n```";
    const result = parseResponse(wrapped);
    expect(result.step1FactIdentification).toBe("Facts");
    expect(result.confidenceLevel).toBe("MEDIUM");
  });

  it("returns fallback on invalid JSON", () => {
    const result = parseResponse("not json at all");
    expect(result.confidenceLevel).toBe("NEEDS_REVIEW");
    expect(result.step1FactIdentification).toContain("Unable to parse");
    expect(result.rawResponse).toBe("not json at all");
  });

  it("returns fallback on empty string", () => {
    const result = parseResponse("");
    expect(result.confidenceLevel).toBe("NEEDS_REVIEW");
    expect(result.isCivilMatter).toBe(false);
    expect(result.needsClarification).toBe(false);
  });

  it("handles partial JSON with defaults", () => {
    const partial = JSON.stringify({ step1FactIdentification: "Only one field" });
    const result = parseResponse(partial);
    expect(result.step1FactIdentification).toBe("Only one field");
    expect(result.step2LegalClassification).toContain("No legal classification");
    expect(result.confidenceLevel).toBe("NEEDS_REVIEW");
  });

  it("rejects invalid confidence levels", () => {
    const data = {
      step1FactIdentification: "Facts",
      step2LegalClassification: "Class",
      step3ElementsAnalysis: "Elements",
      step4DefensesAndMitigation: "Defenses",
      step5SentencingFramework: "Framework",
      step6PrecedentApplication: "Precedents",
      step7Conclusion: "Conclusion",
      estimatedPunishment: "Fine",
      confidenceLevel: "INVALID",
      confidenceReason: "Reason",
      proceduralRoadmap: "Roadmap",
      disclaimer: "Disclaimer",
      isCivilMatter: false,
      needsClarification: false,
    };
    const result = parseResponse(JSON.stringify(data));
    expect(result.confidenceLevel).toBe("NEEDS_REVIEW");
  });

  it("handles civil matter response", () => {
    const data = {
      step1FactIdentification: "Facts",
      step2LegalClassification: "Civil",
      step3ElementsAnalysis: "Elements",
      step4DefensesAndMitigation: "Defenses",
      step5SentencingFramework: "N/A",
      step6PrecedentApplication: "N/A",
      step7Conclusion: "Civil matter",
      estimatedPunishment: "N/A",
      confidenceLevel: "HIGH",
      confidenceReason: "Clear civil matter",
      proceduralRoadmap: "File civil suit",
      disclaimer: "Not legal advice",
      isCivilMatter: true,
      civilExplanation: "This is a contract dispute",
      needsClarification: false,
    };
    const result = parseResponse(JSON.stringify(data));
    expect(result.isCivilMatter).toBe(true);
    expect(result.civilExplanation).toBe("This is a contract dispute");
  });

  it("handles clarification needed response", () => {
    const data = {
      step1FactIdentification: "Facts",
      step2LegalClassification: "Class",
      step3ElementsAnalysis: "Elements",
      step4DefensesAndMitigation: "Defenses",
      step5SentencingFramework: "Framework",
      step6PrecedentApplication: "Precedents",
      step7Conclusion: "Conclusion",
      estimatedPunishment: "Unknown",
      confidenceLevel: "LOW",
      confidenceReason: "Insufficient info",
      proceduralRoadmap: "Provide more details",
      disclaimer: "Not legal advice",
      isCivilMatter: false,
      needsClarification: true,
      clarifyingQuestions: ["What was the weapon?", "Where did it happen?"],
    };
    const result = parseResponse(JSON.stringify(data));
    expect(result.needsClarification).toBe(true);
    expect(result.clarifyingQuestions).toEqual(["What was the weapon?", "Where did it happen?"]);
  });
});

describe("validateResult", () => {
  it("returns true for valid result", () => {
    const result = parseResponse(
      JSON.stringify({
        step1FactIdentification: "Facts",
        step2LegalClassification: "Class",
        step3ElementsAnalysis: "Elements",
        step4DefensesAndMitigation: "Defenses",
        step5SentencingFramework: "Framework",
        step6PrecedentApplication: "Precedents",
        step7Conclusion: "Conclusion",
        estimatedPunishment: "Fine",
        confidenceLevel: "HIGH",
        confidenceReason: "Reason",
        proceduralRoadmap: "Roadmap",
        disclaimer: "Disclaimer",
        isCivilMatter: false,
        needsClarification: false,
        rawResponse: "raw",
      })
    );
    expect(validateResult(result)).toBe(true);
  });

  it("returns false for null", () => {
    expect(validateResult(null as unknown as AnalysisResult)).toBe(false);
  });
});
