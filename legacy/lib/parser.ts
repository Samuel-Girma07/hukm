/**
 * HUKM — Response Parser
 *
 * Parses raw AI response into structured AnalysisResult.
 * Never throws - always returns a valid AnalysisResult with safe fallbacks.
 */

import { AnalysisResult, ConfidenceLevel } from "./types";
import { logger } from "./logger";

// ============================================================================
// PARSER FUNCTION
// ============================================================================

/**
 * Parses raw AI response text into a valid AnalysisResult
 *
 * This function NEVER throws. It always returns a valid AnalysisResult,
 * using safe fallbacks for any missing or invalid fields.
 *
 * @param rawResponse - The raw text response from the AI
 * @returns A valid AnalysisResult object
 */
export function parseResponse(rawResponse: string): AnalysisResult {
  // Strip markdown fences if present
  const cleaned = stripMarkdownFences(rawResponse);

  // Try to parse JSON
  let parsed: unknown = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // JSON parsing failed - return safe fallback
    logger.error("JSON parsing failed:", e);
    return createFallbackResult(rawResponse, "JSON parsing failed");
  }

  // Validate and build result
  return buildValidResult(parsed, rawResponse);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Strips markdown code fences from text
 *
 * @param text - Text that may contain markdown fences
 * @returns Text with fences removed
 */
function stripMarkdownFences(text: string): string {
  // Remove opening fence like ```json or ```
  text = text.replace(/^```(?:json)?\s*\n/, "");

  // Remove closing fence
  text = text.replace(/\n```\s*$/, "");

  return text.trim();
}

/**
 * Creates a fallback result when parsing fails
 *
 * @param rawResponse - The original raw response
 * @param errorReason - Reason for fallback
 * @returns Fallback AnalysisResult with LOW confidence
 */
function createFallbackResult(
  rawResponse: string,
  errorReason: string,
): AnalysisResult {
  return {
    step1FactIdentification:
      "Unable to parse analysis due to response format error.",
    step2LegalClassification:
      "Unable to parse analysis due to response format error.",
    step3ElementsAnalysis:
      "Unable to parse analysis due to response format error.",
    step4DefensesAndMitigation:
      "Unable to parse analysis due to response format error.",
    step5SentencingFramework:
      "Unable to parse analysis due to response format error.",
    step6PrecedentApplication:
      "Unable to parse analysis due to response format error.",
    step7Conclusion: "Unable to parse analysis due to response format error.",
    estimatedPunishment: "Unknown",
    confidenceLevel: "NEEDS_REVIEW" as ConfidenceLevel,
    confidenceReason: `Response parsing failed: ${errorReason}. The AI did not return valid JSON.`,
    proceduralRoadmap:
      "Unable to provide procedural guidance due to parsing error.",
    disclaimer:
      "This analysis could not be generated due to a technical error. Please try again.",
    isCivilMatter: false,
    needsClarification: false,
    rawResponse: rawResponse,
  };
}

/**
 * Builds a valid AnalysisResult from parsed JSON with validation
 *
 * @param parsed - Parsed JSON object
 * @param rawResponse - Original raw response
 * @returns Valid AnalysisResult with all required fields
 */
function buildValidResult(
  parsed: unknown,
  rawResponse: string,
): AnalysisResult {
  const result: Partial<AnalysisResult> = {};

  // Helper to safely get string field
  const getString = (key: string, fallback: string): string => {
    if (
      parsed &&
      typeof parsed === "object" &&
      key in parsed &&
      typeof (parsed as Record<string, unknown>)[key] === "string"
    ) {
      return (parsed as Record<string, unknown>)[key] as string;
    }
    return fallback;
  };

  // Helper to safely get boolean field
  const getBoolean = (key: string, fallback: boolean): boolean => {
    if (
      parsed &&
      typeof parsed === "object" &&
      key in parsed &&
      typeof (parsed as Record<string, unknown>)[key] === "boolean"
    ) {
      return (parsed as Record<string, unknown>)[key] as boolean;
    }
    return fallback;
  };

  // Helper to safely get string array
  const getStringArray = (key: string, fallback: string[]): string[] => {
    if (
      parsed &&
      typeof parsed === "object" &&
      key in parsed &&
      Array.isArray((parsed as Record<string, unknown>)[key]) &&
      (parsed as Record<string, unknown>)[key]
    ) {
      const arr = (parsed as Record<string, unknown>)[key] as unknown[];
      if (arr.every((item) => typeof item === "string")) {
        return arr as string[];
      }
    }
    return fallback;
  };

  // Validate confidence level
  const validConfidenceLevels = ["HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"];
  let confidenceLevel: ConfidenceLevel = "NEEDS_REVIEW";
  const parsedConfidence = getString("confidenceLevel", "");
  if (parsedConfidence && validConfidenceLevels.includes(parsedConfidence)) {
    confidenceLevel = parsedConfidence as ConfidenceLevel;
  }

  // Build result with all required fields
  result.step1FactIdentification = getString(
    "step1FactIdentification",
    "No fact identification provided.",
  );
  result.step2LegalClassification = getString(
    "step2LegalClassification",
    "No legal classification provided.",
  );
  result.step3ElementsAnalysis = getString(
    "step3ElementsAnalysis",
    "No elements analysis provided.",
  );
  result.step4DefensesAndMitigation = getString(
    "step4DefensesAndMitigation",
    "No defenses or mitigation identified.",
  );
  result.step5SentencingFramework = getString(
    "step5SentencingFramework",
    "No sentencing framework provided.",
  );
  result.step6PrecedentApplication = getString(
    "step6PrecedentApplication",
    "No precedent application provided.",
  );
  result.step7Conclusion = getString(
    "step7Conclusion",
    "No conclusion provided.",
  );

  result.estimatedPunishment = getString("estimatedPunishment", "Unknown");

  result.confidenceLevel = confidenceLevel;
  result.confidenceReason = getString(
    "confidenceReason",
    "Confidence reason not provided.",
  );

  result.proceduralRoadmap = getString(
    "proceduralRoadmap",
    "No procedural roadmap provided.",
  );

  result.disclaimer = getString(
    "disclaimer",
    "This is an AI-generated analysis and does not constitute legal advice. Consult a qualified lawyer.",
  );

  result.isCivilMatter = getBoolean("isCivilMatter", false);
  result.civilExplanation = getString("civilExplanation", "") || undefined;

  result.needsClarification = getBoolean("needsClarification", false);
  result.clarifyingQuestions = getStringArray("clarifyingQuestions", []);

  result.rawResponse = rawResponse;

  return result as AnalysisResult;
}

/**
 * Validates that an AnalysisResult has all required fields
 *
 * @param result - Result to validate
 * @returns true if valid, false otherwise
 */
export function validateResult(result: AnalysisResult): boolean {
  if (!result) return false;

  const requiredStringFields = [
    "step1FactIdentification",
    "step2LegalClassification",
    "step3ElementsAnalysis",
    "step4DefensesAndMitigation",
    "step5SentencingFramework",
    "step6PrecedentApplication",
    "step7Conclusion",
    "estimatedPunishment",
    "confidenceReason",
    "proceduralRoadmap",
    "disclaimer",
    "rawResponse",
  ];

  for (const field of requiredStringFields) {
    if (
      !result[field as keyof AnalysisResult] ||
      typeof result[field as keyof AnalysisResult] !== "string"
    ) {
      return false;
    }
  }

  const validConfidenceLevels = ["HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"];
  if (!validConfidenceLevels.includes(result.confidenceLevel)) {
    return false;
  }

  if (
    typeof result.isCivilMatter !== "boolean" ||
    typeof result.needsClarification !== "boolean"
  ) {
    return false;
  }

  return true;
}
