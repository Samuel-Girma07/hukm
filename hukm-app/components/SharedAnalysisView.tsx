"use client";

import Link from "next/link";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { Icon } from "./Icon";
import { SourcesPanel } from "./SourcesPanel";

import { useT } from "@/contexts/LanguageContext";
import { getModelTierLabel } from "@/lib/models";
import type { AnalysisResult, LawChunk } from "@/lib/types";

interface SharedAnalysisViewProps {
  token: string;
  scenario: string;
  modelId: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  viewCount: number;
  createdAt: string;
}

const STEPS: ReadonlyArray<{
  field: keyof AnalysisResult;
  i18nKey: string;
}> = [
  { field: "step1FactIdentification", i18nKey: "analysisSteps.s1" },
  { field: "step2LegalClassification", i18nKey: "analysisSteps.s2" },
  { field: "step3ElementsAnalysis", i18nKey: "analysisSteps.s3" },
  { field: "step4DefensesAndMitigation", i18nKey: "analysisSteps.s4" },
  { field: "step5SentencingFramework", i18nKey: "analysisSteps.s5" },
  { field: "step6PrecedentApplication", i18nKey: "analysisSteps.s6" },
  { field: "step7Conclusion", i18nKey: "analysisSteps.s7" },
];

function cleanStepTitle(raw: string): string {
  return raw.replace(/^Step \d+\s*[—-]\s*/, "").replace(/^ደረጃ \d+\s*[—-]\s*/, "");
}

export function SharedAnalysisView({
  scenario,
  modelId,
  result,
  retrievedChunks,
  viewCount,
  createdAt,
}: SharedAnalysisViewProps): React.ReactElement {
  const t = useT();
  const countLabel =
    viewCount === 1 ? t("share.viewCountOne") : t("share.viewCountOther");
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">
          <Icon name="share" size={10} />
          {t("share.publicTitle")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant tabular-nums">
          <Icon name="visibility" size={12} />
          {t("share.viewCount", { count: viewCount, countLabel })}
        </span>
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="text-[clamp(28px,3.2vw,40px)] font-semibold leading-tight tracking-tight text-on-surface">
          {result.isCivilMatter
            ? t("results.headingCivil")
            : t("results.headingCriminal")}
        </h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
          {t("share.publicSubtitle")}
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.modelLabel")}{" "}
          <span className="font-normal normal-case tracking-normal text-on-surface-variant">
            {getModelTierLabel(modelId)}
          </span>{" "}
          <span className="opacity-50">·</span>{" "}
          {new Date(createdAt).toLocaleDateString()}
        </p>
      </header>

      <div className="flex">
        <ConfidenceBadge level={result.confidenceLevel} />
      </div>

      <section className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.scenarioLabel")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-on-surface">
          {scenario}
        </p>
      </section>

      {/* Seven-step cards */}
      <section className="flex flex-col gap-3">
        {STEPS.map((entry, idx) => {
          const value = result[entry.field];
          const text = typeof value === "string" ? value : "—";
          const title = cleanStepTitle(t(entry.i18nKey));
          return (
            <article
              key={entry.field}
              className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]"
            >
              <div className="p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-overlay))] text-[12px] font-semibold text-on-surface-variant">
                    {idx + 1}
                  </span>
                  <h2 className="text-[17px] font-semibold tracking-tight text-on-surface">
                    {title}
                  </h2>
                </div>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface-variant">
                  {text}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      {/* Estimated punishment highlight */}
      <section className="relative overflow-hidden rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-[rgb(var(--accent-blue)/0.10)]"
        />
        <div className="relative p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--accent-cyan))]">
            {t("results.estimatedPunishment")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[clamp(22px,2.4vw,32px)] font-semibold tracking-tight text-on-surface">
            {result.estimatedPunishment}
          </p>
        </div>
      </section>

      <section className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6">
        <h2 className="text-[18px] font-semibold tracking-tight text-on-surface">
          {t("results.proceduralRoadmap")}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface-variant">
          {result.proceduralRoadmap}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-on-surface">
          {t("results.sources")}
        </h2>
        <SourcesPanel chunks={retrievedChunks} layout="flat" />
      </section>

      <section className="rounded-[12px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface))] px-5 py-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.disclaimer")}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-on-surface-variant">
          {result.disclaimer}
        </p>
      </section>

      <div className="flex justify-center border-t border-[rgb(var(--border-subtle))] pt-6">
        <Link href="/" className="btn-primary">
          <span>{t("share.tryHukm")}</span>
          <Icon name="arrow_forward" size={14} />
        </Link>
      </div>
    </div>
  );
}
