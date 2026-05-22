/**
 * HUKM — Safe response parser.
 *
 * Contract: this function NEVER throws. Whatever the model returned
 * (well-formed JSON, slightly broken JSON, plain prose, or empty),
 * we always return a valid `AnalysisResult`. The two failure paths:
 *
 *   1. JSON.parse throws  →  result with confidenceLevel = NEEDS_REVIEW,
 *                            every step field set to a clear error string,
 *                            rawResponse preserved for debugging.
 *   2. JSON parses but a required field is missing or the wrong type →
 *                            we fill the missing/wrong field with a safe
 *                            fallback string but keep the user-visible
 *                            confidence level reported by the model. If
 *                            too many fields are missing, we downgrade
 *                            to NEEDS_REVIEW.
 *
 * The raw model output is ALWAYS preserved in `rawResponse` so a human
 * reviewer can inspect what came back from the LLM.
 *
 * In addition to the JSON, the prompt asks the model to emit a single
 * trailing line:  `SUGGESTIONS: q1 | q2 | q3` — these are extracted into
 * `suggestedFollowUps`. The marker is optional; absence does not affect
 * confidence.
 */

import { logger } from "./logger";
import { addBreadcrumb } from "./sentry";
import type { AnalysisResult, ConfidenceLevel } from "./types";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parseAnalysisResponse(rawResponse: string): AnalysisResult {
  if (typeof rawResponse !== "string" || rawResponse.trim().length === 0) {
    return makeFailureResult(rawResponse ?? "", "empty response");
  }

  const cleaned = stripCodeFences(rawResponse);
  const candidate = extractJsonObject(cleaned);

  if (candidate === null) {
    addBreadcrumb("parser", "no JSON object found in response");
    logger.warn("[parser] no JSON object found in response", {
      length: rawResponse.length,
    });
    return makeFailureResult(rawResponse, "no JSON object found");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    addBreadcrumb("parser", "JSON.parse failed");
    logger.warn("[parser] JSON.parse failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return makeFailureResult(rawResponse, "JSON parse error");
  }

  if (!isObject(parsed)) {
    return makeFailureResult(rawResponse, "JSON root is not an object");
  }

  const followUps = extractSuggestions(rawResponse);
  return buildResult(parsed, rawResponse, followUps);
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  return cleaned.trim();
}

/**
 * Attempts to find the outermost JSON object substring. Some models
 * slip stray prose before/after the JSON despite our prompt; this
 * walks the string, counts braces, and returns the first balanced
 * object. Falls back to the simple "first { … last }" slice if the
 * walk doesn't terminate (e.g. unterminated string).
 */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1) return null;

  // Scan forward from the first brace, respecting strings and escapes.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return trimmed.slice(firstBrace, i + 1);
    }
  }

  // Unbalanced — fall back to the cheapest possible slice.
  const lastBrace = trimmed.lastIndexOf("}");
  if (lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return null;
}

/**
 * Extracts the `SUGGESTIONS: a | b | c` line emitted after the JSON.
 * Tolerant of trailing whitespace, missing pipes (single suggestion),
 * and extra punctuation. Returns at most 3 suggestions.
 */
function extractSuggestions(raw: string): string[] {
  const match = raw.match(/SUGGESTIONS\s*:\s*(.+?)(?:\r?\n|$)/i);
  if (!match || !match[1]) return [];
  return match[1]
    .split("|")
    .map((s) => s.trim().replace(/^[-*•]\s*/, "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Result building
// ---------------------------------------------------------------------------

const REQUIRED_STRING_FIELDS: ReadonlyArray<keyof AnalysisResult> = [
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
];

function buildResult(
  parsed: Record<string, unknown>,
  raw: string,
  inlineFollowUps: string[],
): AnalysisResult {
  let missing = 0;

  const getStr = (key: string, fallback: string): string => {
    const value = parsed[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    missing += 1;
    return fallback;
  };

  const getOptionalStr = (key: string): string | undefined => {
    const value = parsed[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    return undefined;
  };

  const getBool = (key: string, fallback: boolean): boolean => {
    const value = parsed[key];
    if (typeof value === "boolean") return value;
    return fallback;
  };

  const getStringArray = (key: string): string[] | undefined => {
    const value = parsed[key];
    if (!Array.isArray(value)) return undefined;
    const filtered = value.filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    return filtered.length > 0 ? filtered : undefined;
  };

  const result: AnalysisResult = {
    step1FactIdentification: getStr(
      "step1FactIdentification",
      "Fact identification missing from model response.",
    ),
    step2LegalClassification: getStr(
      "step2LegalClassification",
      "Legal classification missing from model response.",
    ),
    step3ElementsAnalysis: getStr(
      "step3ElementsAnalysis",
      "Elements analysis missing from model response.",
    ),
    step4DefensesAndMitigation: getStr(
      "step4DefensesAndMitigation",
      "Defences and mitigation missing from model response.",
    ),
    step5SentencingFramework: getStr(
      "step5SentencingFramework",
      "Sentencing framework missing from model response.",
    ),
    step6PrecedentApplication: getStr(
      "step6PrecedentApplication",
      "Precedent application missing from model response.",
    ),
    step7Conclusion: getStr(
      "step7Conclusion",
      "Conclusion missing from model response.",
    ),
    estimatedPunishment: getStr(
      "estimatedPunishment",
      "Cannot be estimated from the available response.",
    ),
    confidenceLevel: normaliseConfidenceLevel(parsed.confidenceLevel),
    confidenceReason: getStr(
      "confidenceReason",
      "Confidence reason was not provided in the model response.",
    ),
    proceduralRoadmap: getStr(
      "proceduralRoadmap",
      "Procedural roadmap was not provided in the model response.",
    ),
    disclaimer: getStr(
      "disclaimer",
      "This analysis is AI-generated and does not constitute legal advice. Consult a qualified Ethiopian advocate.",
    ),
    isCivilMatter: getBool("isCivilMatter", false),
    civilExplanation: getOptionalStr("civilExplanation"),
    needsClarification: getBool("needsClarification", false),
    clarifyingQuestions: getStringArray("clarifyingQuestions"),
    suggestedFollowUps: pickFollowUps(parsed, inlineFollowUps),
    detectedCrimeCategory: getOptionalStr("detectedCrimeCategory"),
    rawResponse: raw,
  };

  const totalRequired = REQUIRED_STRING_FIELDS.length;
  if (missing >= Math.ceil(totalRequired / 2)) {
    result.confidenceLevel = "NEEDS_REVIEW";
    result.confidenceReason = `Model response was missing ${missing} of ${totalRequired} required fields. Original confidence override applied.`;
    addBreadcrumb("parser", "downgraded to NEEDS_REVIEW", {
      missing,
      totalRequired,
    });
    logger.warn("[parser] downgraded to NEEDS_REVIEW", {
      missing,
      totalRequired,
    });
  }

  return result;
}

function pickFollowUps(
  parsed: Record<string, unknown>,
  inline: string[],
): string[] | undefined {
  // Prefer an explicit JSON field if the model included one.
  const fromJson = parsed.suggestedFollowUps;
  if (Array.isArray(fromJson)) {
    const filtered = fromJson
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 3);
    if (filtered.length > 0) return filtered;
  }
  if (inline.length > 0) return inline;
  return undefined;
}

function normaliseConfidenceLevel(value: unknown): ConfidenceLevel {
  if (typeof value !== "string") return "NEEDS_REVIEW";
  const normalised = value.toUpperCase().trim();
  if (
    normalised === "HIGH" ||
    normalised === "MEDIUM" ||
    normalised === "LOW" ||
    normalised === "NEEDS_REVIEW"
  ) {
    return normalised;
  }
  if (normalised === "MED" || normalised === "MID") return "MEDIUM";
  if (normalised === "HI") return "HIGH";
  if (normalised === "LO") return "LOW";
  return "NEEDS_REVIEW";
}

// ---------------------------------------------------------------------------
// Failure helpers
// ---------------------------------------------------------------------------

function makeFailureResult(rawResponse: string, reason: string): AnalysisResult {
  const note = `Unable to parse a structured analysis from the model response (${reason}). The raw response is preserved for review.`;
  return {
    step1FactIdentification: note,
    step2LegalClassification: note,
    step3ElementsAnalysis: note,
    step4DefensesAndMitigation: note,
    step5SentencingFramework: note,
    step6PrecedentApplication: note,
    step7Conclusion: note,
    estimatedPunishment: "Cannot be estimated.",
    confidenceLevel: "NEEDS_REVIEW",
    confidenceReason: `Parser fell back to a safe result: ${reason}.`,
    proceduralRoadmap:
      "Try resubmitting the scenario, or pick a different model from the registry.",
    disclaimer:
      "This analysis is AI-generated and does not constitute legal advice. Consult a qualified Ethiopian advocate.",
    isCivilMatter: false,
    civilExplanation: undefined,
    needsClarification: false,
    clarifyingQuestions: undefined,
    suggestedFollowUps: undefined,
    detectedCrimeCategory: undefined,
    rawResponse,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
