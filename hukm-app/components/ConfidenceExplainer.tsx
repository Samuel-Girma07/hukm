"use client";

import { useState } from "react";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { Icon } from "./Icon";

import { useT } from "@/contexts/LanguageContext";
import type { ConfidenceLevel, RetrievalResult } from "@/lib/types";

interface ConfidenceExplainerProps {
  level: ConfidenceLevel;
  reason: string;
  retrieval?: RetrievalResult | null;
  parsedOk?: boolean;
  /** Shown as a compact pill next to the badge when true. */
  cached?: boolean;
}

export function ConfidenceExplainer({
  level,
  reason,
  retrieval,
  parsedOk = true,
  cached = false,
}: ConfidenceExplainerProps): React.ReactElement {
  const t = useT();
  const [open, setOpen] = useState(true);

  const stage = retrieval?.stage ?? null;
  const max = retrieval?.maxSimilarity ?? 0;
  const chunks = retrieval?.chunks ?? [];
  const strong = chunks.filter((c) => c.similarity >= 0.7).length;
  const moderate = chunks.filter(
    (c) => c.similarity >= 0.5 && c.similarity < 0.7,
  ).length;
  const weak = chunks.filter((c) => c.similarity < 0.5).length;

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <ConfidenceBadge level={level} />
          {cached ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--accent-cyan)/0.4)] bg-[rgb(var(--accent-cyan)/0.10)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(var(--accent-cyan))]">
              <Icon name="bolt" size={12} filled />
              {t("results.cacheBadge")}
            </span>
          ) : null}
          <p className="max-w-xl text-[14px] text-on-surface-variant">
            {reason}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="btn-icon"
        >
          <Icon name={open ? "expand_less" : "expand_more"} size={18} />
        </button>
      </div>

      {open ? (
        <>
          <div className="grid grid-cols-2 gap-4 border-t border-[rgb(var(--border-subtle))] pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <Stat
              label={t("results.confidenceExplainer.stage")}
              value={
                stage === null
                  ? "—"
                  : stage === 1
                    ? t("results.confidenceExplainer.stagePrimary")
                    : t("results.confidenceExplainer.stageFallback")
              }
            />
            <Stat
              label={t("results.confidenceExplainer.maxSimilarity")}
              value={`${(max * 100).toFixed(1)}%`}
              tone={max >= 0.7 ? "primary" : "neutral"}
            />
            <Stat
              label={t("results.confidenceExplainer.strongMatches")}
              value={String(strong)}
            />
            <Stat
              label={t("results.confidenceExplainer.moderateMatches")}
              value={String(moderate)}
            />
            <Stat
              label={t("results.confidenceExplainer.weakMatches")}
              value={String(weak)}
            />
            <Stat label="Chunks retrieved" value={String(chunks.length)} />
            <Stat
              label={t("results.confidenceExplainer.parseStatus")}
              value={
                parsedOk
                  ? t("results.confidenceExplainer.parsedOk")
                  : t("results.confidenceExplainer.parsedFail")
              }
              tone={parsedOk ? "primary" : "error"}
            />
          </div>
          <p className="border-t border-[rgb(var(--border-subtle))] pt-4 text-[13px] text-on-surface-variant">
            {t("results.confidenceExplainer.learnMore")}
          </p>
        </>
      ) : null}
    </section>
  );
}

interface StatProps {
  label: string;
  value: string;
  tone?: "neutral" | "primary" | "error";
}

function Stat({ label, value, tone = "neutral" }: StatProps): React.ReactElement {
  const toneClass =
    tone === "primary"
      ? "text-[rgb(var(--accent-cyan))]"
      : tone === "error"
        ? "text-[rgb(var(--accent-red))]"
        : "text-on-surface";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </span>
      <span className={`text-[18px] font-semibold tabular-nums ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}
