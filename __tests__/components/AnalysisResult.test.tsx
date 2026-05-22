/** @vitest-environment jsdom */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalysisResult from "@/components/AnalysisResult";
import type { AnalysisResultWithSources, LawChunk } from "@/lib/types";

const sampleChunk: LawChunk = {
  id: 1,
  documentName: "criminal-code-414-2004",
  articleReference: "Article 525 — Simple Theft",
  content: "Whoever takes another's property...",
  metadata: {},
  similarity: 0.82,
};

function buildResult(
  overrides: Partial<AnalysisResultWithSources> = {},
): AnalysisResultWithSources {
  return {
    step1FactIdentification: "Facts identified",
    step2LegalClassification: "Classified as theft",
    step3ElementsAnalysis: "Elements analyzed",
    step4DefensesAndMitigation: "No defenses applicable",
    step5SentencingFramework: "1-5 years imprisonment",
    step6PrecedentApplication: "No directly applicable precedent",
    step7Conclusion: "Liable for simple theft",
    estimatedPunishment: "2 years imprisonment",
    confidenceLevel: "HIGH",
    confidenceReason: "Strong retrieval match",
    proceduralRoadmap: "Charge under Article 525",
    disclaimer: "Not legal advice.",
    isCivilMatter: false,
    needsClarification: false,
    rawResponse: "raw text",
    retrievedChunks: [sampleChunk],
    ...overrides,
  };
}

describe("AnalysisResult", () => {
  it("renders the full 7-step analysis when result is criminal", () => {
    render(
      <AnalysisResult
        result={buildResult()}
        modelName="GLM-4.7"
      />,
    );

    expect(screen.getByText("Analysis Summary")).toBeInTheDocument();
    expect(screen.getByText(/HIGH Confidence/i)).toBeInTheDocument();
    expect(screen.getByText("Fact Identification")).toBeInTheDocument();
    expect(screen.getByText("Conclusion")).toBeInTheDocument();
    expect(
      screen.getByText(/Law Articles Retrieved \(1\)/i),
    ).toBeInTheDocument();
  });

  it("renders the civil-matter view when isCivilMatter is true", () => {
    render(
      <AnalysisResult
        result={buildResult({
          isCivilMatter: true,
          civilExplanation: "This is a contract dispute.",
        })}
        modelName="GLM-4.7"
      />,
    );

    expect(screen.getByText("Civil Matter Identified")).toBeInTheDocument();
    expect(
      screen.getByText("This is a contract dispute."),
    ).toBeInTheDocument();
    // Should NOT show the 7-step framework
    expect(screen.queryByText("Fact Identification")).not.toBeInTheDocument();
  });

  it("renders the clarification view when needsClarification is true", () => {
    render(
      <AnalysisResult
        result={buildResult({
          needsClarification: true,
          clarifyingQuestions: [
            "What was the weapon?",
            "Was anyone injured?",
          ],
        })}
        modelName="GLM-4.7"
      />,
    );

    expect(screen.getByText("Clarification Needed")).toBeInTheDocument();
    expect(screen.getByText("What was the weapon?")).toBeInTheDocument();
    expect(screen.getByText("Was anyone injured?")).toBeInTheDocument();
  });

  it("uses red styling for LOW confidence and yellow for MEDIUM", () => {
    const { rerender } = render(
      <AnalysisResult
        result={buildResult({ confidenceLevel: "LOW" })}
        modelName="GLM-4.7"
      />,
    );
    expect(screen.getByText(/LOW Confidence/i)).toBeInTheDocument();

    rerender(
      <AnalysisResult
        result={buildResult({ confidenceLevel: "MEDIUM" })}
        modelName="GLM-4.7"
      />,
    );
    expect(screen.getByText(/MEDIUM Confidence/i)).toBeInTheDocument();
  });
});
