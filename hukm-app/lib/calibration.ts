/**
 * HUKM â€” Confidence calibration engine.
 *
 * Analyses historical analyses and feedback to empirically determine
 * optimal confidence thresholds. This replaces guesswork with data.
 */

import "server-only";

import { getServerClient } from "./supabase";
import { logger } from "./logger";
import type { ConfidenceLevel } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThresholdSuggestion {
  metric: string;
  current: number;
  suggested: number;
  rationale: string;
}

export interface ConfidenceAccuracy {
  level: ConfidenceLevel;
  total: number;
  thumbsUp: number;
  thumbsDown: number;
  accuracy: number; // 0-1
}

export interface CalibrationInsight {
  type: "threshold" | "pattern" | "anomaly";
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface CalibrationReport {
  generatedAt: string;
  totalAnalyses: number;
  analysesWithFeedback: number;
  thresholdSuggestions: ThresholdSuggestion[];
  accuracyByConfidence: ConfidenceAccuracy[];
  accuracyByThreshold: Array<{
    threshold: number;
    total: number;
    accuracy: number;
  }>;
  insights: CalibrationInsight[];
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface AnalysisWithFeedback {
  id: string;
  result: {
    retrieval?: {
      chunks: Array<{ similarity: number }>;
      stage: number;
      maxSimilarity: number;
    };
    confidenceLevel: ConfidenceLevel;
  };
  retrieval_stats?: {
    strongCount: number;
    moderateCount: number;
    weakCount: number;
    maxSimilarity: number;
    hasPunishment: boolean;
    hasCriminalCode: boolean;
    stage: number;
  } | null;
  feedback?: {
    rating: number;
  }[];
}

async function fetchAnalysesWithFeedback(): Promise<AnalysisWithFeedback[]> {
  const supabase = getServerClient();

  // Fetch analyses with their feedback, limited to last 500 for performance
  const { data, error } = await supabase
    .from("analysis_results")
    .select(
      `
      id,
      result,
      retrieval_stats,
      feedback:feedback(analysis_id, rating)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    logger.error("[calibration] failed to fetch analyses", { error: error.message });
    throw new Error(`Database query failed: ${error.message}`);
  }

  return (data ?? []) as AnalysisWithFeedback[];
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function computeAccuracy(analyses: AnalysisWithFeedback[]): ConfidenceAccuracy[] {
  const byLevel: Record<string, { up: number; down: number; total: number }> = {};

  for (const a of analyses) {
    const level = a.result?.confidenceLevel ?? "NEEDS_REVIEW";
    if (!byLevel[level]) {
      byLevel[level] = { up: 0, down: 0, total: 0 };
    }
    byLevel[level].total++;

    const feedback = a.feedback ?? [];
    for (const f of feedback) {
      if (f.rating === 1) byLevel[level].up++;
      else if (f.rating === -1) byLevel[level].down++;
    }
  }

  const levels: ConfidenceLevel[] = ["HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"];
  return levels.map((level) => {
    const stats = byLevel[level] ?? { up: 0, down: 0, total: 0 };
    const totalFeedback = stats.up + stats.down;
    return {
      level,
      total: stats.total,
      thumbsUp: stats.up,
      thumbsDown: stats.down,
      accuracy: totalFeedback > 0 ? stats.up / totalFeedback : 0,
    };
  });
}

function analyzeThresholds(
  analyses: AnalysisWithFeedback[],
): ThresholdSuggestion[] {
  const suggestions: ThresholdSuggestion[] = [];

  // We need analyses with both feedback and retrieval_stats
  const withStats = analyses.filter(
    (a) => a.retrieval_stats && (a.feedback?.length ?? 0) > 0,
  );

  if (withStats.length < 20) {
    return suggestions; // Not enough data
  }

  // --- Strong threshold analysis (currently 0.70) ---
  // Find the threshold that maximizes accuracy for "strong" matches
  const thresholds = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
  let bestThreshold = 0.70;
  let bestAccuracy = 0;

  for (const threshold of thresholds) {
    const relevant = withStats.filter((a) => {
      const maxSim = a.retrieval_stats?.maxSimilarity ?? 0;
      return maxSim >= threshold;
    });

    if (relevant.length < 5) continue;

    const up = relevant.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating === 1),
    ).length;
    const total = relevant.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating !== 0),
    ).length;

    if (total === 0) continue;
    const accuracy = up / total;

    if (accuracy > bestAccuracy) {
      bestAccuracy = accuracy;
      bestThreshold = threshold;
    }
  }

  if (bestThreshold !== 0.70) {
    suggestions.push({
      metric: "strong_similarity_threshold",
      current: 0.70,
      suggested: bestThreshold,
      rationale: `At threshold ${bestThreshold.toFixed(2)}, analyses with feedback show ${(bestAccuracy * 100).toFixed(1)}% thumbs-up rate vs current threshold.`,
    });
  }

  // --- Count threshold analysis (currently 3 strong for HIGH) ---
  const counts = [1, 2, 3, 4, 5];
  let bestCount = 3;
  let bestCountAccuracy = 0;

  for (const count of counts) {
    const relevant = withStats.filter((a) => {
      const strong = a.retrieval_stats?.strongCount ?? 0;
      return strong >= count;
    });

    if (relevant.length < 5) continue;

    const up = relevant.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating === 1),
    ).length;
    const total = relevant.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating !== 0),
    ).length;

    if (total === 0) continue;
    const accuracy = up / total;

    if (accuracy > bestCountAccuracy) {
      bestCountAccuracy = accuracy;
      bestCount = count;
    }
  }

  if (bestCount !== 3) {
    suggestions.push({
      metric: "strong_count_threshold",
      current: 3,
      suggested: bestCount,
      rationale: `Requiring ${bestCount} strong matches yields ${(bestCountAccuracy * 100).toFixed(1)}% thumbs-up rate vs current requirement of 3.`,
    });
  }

  return suggestions;
}

function analyzeBySimilarityRange(
  analyses: AnalysisWithFeedback[],
): Array<{ threshold: number; total: number; accuracy: number }> {
  const bins = [
    { min: 0.0, max: 0.3 },
    { min: 0.3, max: 0.5 },
    { min: 0.5, max: 0.6 },
    { min: 0.6, max: 0.7 },
    { min: 0.7, max: 0.8 },
    { min: 0.8, max: 1.0 },
  ];

  return bins.map((bin) => {
    const relevant = analyses.filter((a) => {
      const maxSim =
        a.retrieval_stats?.maxSimilarity ??
        a.result?.retrieval?.maxSimilarity ??
        0;
      return maxSim >= bin.min && maxSim < bin.max;
    });

    const withFeedback = relevant.filter(
      (a) => (a.feedback?.length ?? 0) > 0,
    );
    const up = withFeedback.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating === 1),
    ).length;
    const total = withFeedback.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating !== 0),
    ).length;

    return {
      threshold: bin.min,
      total: relevant.length,
      accuracy: total > 0 ? up / total : 0,
    };
  });
}

function generateInsights(
  analyses: AnalysisWithFeedback[],
  accuracyByConfidence: ConfidenceAccuracy[],
): CalibrationInsight[] {
  const insights: CalibrationInsight[] = [];

  const withFeedback = analyses.filter(
    (a) => (a.feedback?.length ?? 0) > 0,
  );

  if (withFeedback.length === 0) {
    insights.push({
      type: "anomaly",
      message:
        "No feedback data available. Confidence calibration requires user ratings. Encourage users to rate analyses.",
      severity: "critical",
    });
    return insights;
  }

  if (withFeedback.length < 50) {
    insights.push({
      type: "anomaly",
      message: `Only ${withFeedback.length} analyses have feedback. Calibration needs at least 50 for reliable threshold tuning.`,
      severity: "warning",
    });
  }

  // Check if LOW confidence analyses are actually accurate
  const lowAcc = accuracyByConfidence.find((a) => a.level === "LOW");
  if (lowAcc && lowAcc.accuracy > 0.6 && lowAcc.total > 5) {
    insights.push({
      type: "threshold",
      message: `LOW confidence analyses have ${(lowAcc.accuracy * 100).toFixed(0)}% thumbs-up rate (${lowAcc.thumbsUp}/${lowAcc.thumbsUp + lowAcc.thumbsDown}). The threshold may be too pessimistic â€” consider lowering the bar for MEDIUM/HIGH.`,
      severity: "warning",
    });
  }

  // Check if HIGH confidence analyses are inaccurate
  const highAcc = accuracyByConfidence.find((a) => a.level === "HIGH");
  if (highAcc && highAcc.accuracy < 0.7 && highAcc.total > 5) {
    insights.push({
      type: "threshold",
      message: `HIGH confidence analyses only have ${(highAcc.accuracy * 100).toFixed(0)}% thumbs-up rate. The threshold may be too generous â€” fewer analyses should qualify as HIGH.`,
      severity: "critical",
    });
  }

  // Check for stage 2 (fallback) analyses that are rated well
  const stage2Analyses = withFeedback.filter((a) => {
    const stage =
      a.retrieval_stats?.stage ?? a.result?.retrieval?.stage ?? 1;
    return stage === 2;
  });
  if (stage2Analyses.length > 3) {
    const up = stage2Analyses.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating === 1),
    ).length;
    const total = stage2Analyses.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating !== 0),
    ).length;
    const accuracy = total > 0 ? up / total : 0;
    if (accuracy > 0.5) {
      insights.push({
        type: "pattern",
        message: `Fallback-stage (stage 2) analyses have ${(accuracy * 100).toFixed(0)}% thumbs-up rate. The fallback threshold (0.0) is producing usable results â€” consider raising it slightly.`,
        severity: "info",
      });
    }
  }

  // Check for analyses with punishment keywords that are rated poorly
  const noPunishmentAnalyses = withFeedback.filter((a) => {
    return !(a.retrieval_stats?.hasPunishment ?? true);
  });
  if (noPunishmentAnalyses.length > 3) {
    const up = noPunishmentAnalyses.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating === 1),
    ).length;
    const total = noPunishmentAnalyses.filter((a) =>
      (a.feedback ?? []).some((f) => f.rating !== 0),
    ).length;
    const accuracy = total > 0 ? up / total : 0;
    if (accuracy < 0.4) {
      insights.push({
        type: "pattern",
        message: `Analyses without punishment provisions in retrieved text have ${(accuracy * 100).toFixed(0)}% thumbs-up rate. The hasPunishment check is a valid signal for confidence.`,
        severity: "info",
      });
    }
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a full calibration report from historical data.
 */
export async function generateCalibrationReport(): Promise<CalibrationReport> {
  const analyses = await fetchAnalysesWithFeedback();

  const withFeedback = analyses.filter(
    (a) => (a.feedback?.length ?? 0) > 0,
  );

  return {
    generatedAt: new Date().toISOString(),
    totalAnalyses: analyses.length,
    analysesWithFeedback: withFeedback.length,
    thresholdSuggestions: analyzeThresholds(analyses),
    accuracyByConfidence: computeAccuracy(analyses),
    accuracyByThreshold: analyzeBySimilarityRange(analyses),
    insights: generateInsights(analyses, computeAccuracy(analyses)),
  };
}

/**
 * Quick check: returns true if we have enough feedback data to
 * make threshold recommendations.
 */
export async function hasEnoughFeedbackData(): Promise<boolean> {
  try {
    const supabase = getServerClient();
    const { count } = await supabase
      .from("feedback")
      .select("*", { count: "exact", head: true });
    return (count ?? 0) >= 50;
  } catch {
    return false;
  }
}

