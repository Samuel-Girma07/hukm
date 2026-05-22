/**
 * HUKM — Deterministic confidence computation.
 *
 * Replaces LLM guesswork with a consistent, auditable formula based on
 * retrieval statistics. The confidence level is computed in code and
 * injected into the prompt as a fact; the LLM only elaborates on the
 * reason.
 */

import type { LawChunk, RetrievalResult, ConfidenceLevel } from "./types";
import { env } from "./env";

export interface ConfidenceAssessment {
  /** Pre-computed confidence level */
  level: ConfidenceLevel;
  /** Human-readable explanation */
  reason: string;
  /** Raw retrieval statistics for persistence and calibration */
  stats: {
    strongCount: number;
    moderateCount: number;
    weakCount: number;
    maxSimilarity: number;
    hasPunishment: boolean;
    hasCriminalCode: boolean;
    stage: number;
    chunkCount: number;
  };
}

/** Similarity thresholds — configurable via env, tunable via calibration */
const STRONG_THRESHOLD = parseFloat(env.STRONG_SIMILARITY_THRESHOLD ?? "0.70");
const MODERATE_THRESHOLD = parseFloat(env.MODERATE_SIMILARITY_THRESHOLD ?? "0.50");
const HIGH_STRONG_COUNT = parseInt(env.HIGH_CONFIDENCE_STRONG_COUNT ?? "3", 10);
const MEDIUM_STRONG_COUNT = parseInt(env.MEDIUM_CONFIDENCE_STRONG_COUNT ?? "1", 10);

/** Regex for detecting explicit punishment provisions in chunk text */
const PUNISHMENT_PATTERN =
  /imprisonment|fine|rigorous|simple|penalty|punishable|years\s+of/i;

/**
 * Returns the currently active thresholds for calibration UI.
 */
export function getCurrentThresholds(): {
  strong: number;
  moderate: number;
  highStrongCount: number;
  mediumStrongCount: number;
} {
  return {
    strong: STRONG_THRESHOLD,
    moderate: MODERATE_THRESHOLD,
    highStrongCount: HIGH_STRONG_COUNT,
    mediumStrongCount: MEDIUM_STRONG_COUNT,
  };
}

/**
 * Computes confidence deterministically from retrieval stats.
 *
 * Rules (in priority order):
 * 1. LOW — Fallback stage or empty results
 * 2. HIGH — ≥N strong matches + punishment provisions + criminal code source
 * 3. HIGH — ≥N strong matches + punishment provisions (any source)
 * 4. MEDIUM — ≥M strong match + punishment provisions
 * 5. MEDIUM — ≥3 moderate+ matches
 * 6. LOW — Everything else
 */
export function computeConfidence(
  retrieval: RetrievalResult,
): ConfidenceAssessment {
  const { chunks, stage, maxSimilarity } = retrieval;

  const strong = chunks.filter((c) => c.similarity >= STRONG_THRESHOLD).length;
  const moderate = chunks.filter(
    (c) => c.similarity >= MODERATE_THRESHOLD && c.similarity < STRONG_THRESHOLD,
  ).length;
  const weak = chunks.filter((c) => c.similarity < MODERATE_THRESHOLD).length;

  const hasPunishment = chunks.some((c) =>
    PUNISHMENT_PATTERN.test(c.content),
  );

  const hasCriminalCode = chunks.some(
    (c) => c.document_name === "criminal-code-414-2004",
  );

  // Rule 1: Fallback stage
  if (stage === 2 || chunks.length === 0) {
    return {
      level: "LOW",
      reason:
        "Retrieval used fallback stage (threshold 0.0) or returned no results. Matches are less precise.",
      stats: {
        strongCount: strong,
        moderateCount: moderate,
        weakCount: weak,
        maxSimilarity,
        hasPunishment,
        hasCriminalCode,
        stage,
        chunkCount: chunks.length,
      },
    };
  }

  // Rule 2: Gold standard — multiple strong criminal code matches with punishment
  if (strong >= HIGH_STRONG_COUNT && hasPunishment && hasCriminalCode) {
    return {
      level: "HIGH",
      reason: `Strong retrieval from Criminal Code: ${strong} articles at ≥${(STRONG_THRESHOLD * 100).toFixed(0)}% similarity with explicit punishment provisions.`,
      stats: {
        strongCount: strong,
        moderateCount: moderate,
        weakCount: weak,
        maxSimilarity,
        hasPunishment,
        hasCriminalCode,
        stage,
        chunkCount: chunks.length,
      },
    };
  }

  // Rule 3: Strong matches with punishment (any source)
  if (strong >= HIGH_STRONG_COUNT && hasPunishment) {
    return {
      level: "HIGH",
      reason: `Strong retrieval: ${strong} articles at ≥${(STRONG_THRESHOLD * 100).toFixed(0)}% similarity with explicit punishment provisions.`,
      stats: {
        strongCount: strong,
        moderateCount: moderate,
        weakCount: weak,
        maxSimilarity,
        hasPunishment,
        hasCriminalCode,
        stage,
        chunkCount: chunks.length,
      },
    };
  }

  // Rule 4: At least one strong match with punishment
  if (strong >= MEDIUM_STRONG_COUNT && hasPunishment) {
    return {
      level: "MEDIUM",
      reason: `Moderate retrieval: ${strong} strong match(es) with punishment provisions. Max similarity ${(maxSimilarity * 100).toFixed(1)}%.`,
      stats: {
        strongCount: strong,
        moderateCount: moderate,
        weakCount: weak,
        maxSimilarity,
        hasPunishment,
        hasCriminalCode,
        stage,
        chunkCount: chunks.length,
      },
    };
  }

  // Rule 5: Multiple moderate matches
  if (strong + moderate >= 3) {
    return {
      level: "MEDIUM",
      reason: `Moderate retrieval: ${strong} strong, ${moderate} moderate matches. Max similarity ${(maxSimilarity * 100).toFixed(1)}%.`,
      stats: {
        strongCount: strong,
        moderateCount: moderate,
        weakCount: weak,
        maxSimilarity,
        hasPunishment,
        hasCriminalCode,
        stage,
        chunkCount: chunks.length,
      },
    };
  }

  // Rule 6: Weak fallback
  return {
    level: "LOW",
    reason: `Weak retrieval: ${chunks.length} total matches (${strong} strong, ${moderate} moderate, ${weak} weak). Max similarity ${(maxSimilarity * 100).toFixed(1)}%.`,
    stats: {
      strongCount: strong,
      moderateCount: moderate,
      weakCount: weak,
      maxSimilarity,
      hasPunishment,
      hasCriminalCode,
      stage,
      chunkCount: chunks.length,
    },
  };
}
