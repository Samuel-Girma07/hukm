"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArticlePanel } from "./ArticlePanel";
import { ConfidenceExplainer } from "./ConfidenceExplainer";
import { ErrorState } from "./ErrorState";
import { FeedbackWidget } from "./FeedbackWidget";
import { Icon } from "./Icon";
import { LawyerCard } from "./LawyerCard";
import { SourcesPanel } from "./SourcesPanel";
import { Spinner } from "./Spinner";
import { StepCard } from "./StepCard";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { Toast } from "./Toast";
import { ShareButton } from "./ShareButton";
import { DownloadButton } from "./DownloadButton";

import { useT } from "@/contexts/LanguageContext";
import { saveAnalysis } from "@/lib/idb";
import { getRelevantResources } from "@/lib/legalDirectory";
import { getModelTierLabel } from "@/lib/models";
import type {
  AnalysisResult,
  CreateShareResponse,
  CrimeCategory,
  LawChunk,
  LegalResource,
  RetrievalResult,
} from "@/lib/types";

interface AnalysisViewProps {
  resultId: string;
  modelId: string;
  scenario: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  retrieval?: RetrievalResult;
  cache?: boolean;
  crimeCategory?: CrimeCategory | null;
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

export function AnalysisView({
  resultId,
  modelId,
  scenario,
  result,
  retrievedChunks,
  retrieval,
  cache = false,
  crimeCategory,
}: AnalysisViewProps): React.ReactElement {
  const t = useT();
  const router = useRouter();
  const [creatingChat, setCreatingChat] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openChunk, setOpenChunk] = useState<LawChunk | null>(null);

  useEffect(() => {
    void saveAnalysis({
      id: resultId,
      scenario,
      modelId,
      result,
      retrievedChunks,
      created_at: new Date().toISOString(),
    });
  }, [resultId, scenario, modelId, result, retrievedChunks]);

  async function continueInChat(): Promise<void> {
    setError(null);
    setCreatingChat(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioDescription: scenario,
          modelId,
          analysisId: resultId,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success: boolean; conversationId?: string; error?: string }
        | null;
      if (!response.ok || !data || !data.success || !data.conversationId) {
        const message =
          data?.error ?? `Failed to start conversation (HTTP ${response.status}).`;
        setError(message);
        return;
      }
      router.push(`/chat/${data.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingChat(false);
    }
  }

  async function shareAnalysis(): Promise<void> {
    setError(null);
    setCreatingShare(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: resultId }),
      });
      const data = (await response.json().catch(() => null)) as
        | CreateShareResponse
        | null;
      if (!response.ok || !data || !data.success) {
        const message =
          data && !data.success && "error" in data
            ? data.error
            : `Failed (HTTP ${response.status}).`;
        setError(message);
        return;
      }
      try {
        await navigator.clipboard.writeText(data.shareUrl);
      } catch {
        // ignore
      }
      setToast(t("results.shareCopied"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingShare(false);
    }
  }

  const lawyers: LegalResource[] = getRelevantResources({
    crimeCategory: crimeCategory ?? undefined,
    isCivilMatter: result.isCivilMatter,
  });

  const heading = result.isCivilMatter
    ? t("results.headingCivil")
    : result.needsClarification
      ? t("results.headingClarify")
      : t("results.headingCriminal");

  const maxSim = retrieval?.maxSimilarity ?? 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{t("results.scenarioLabel")}</span>
          {cache ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--accent-cyan)/0.4)] bg-[rgb(var(--accent-cyan)/0.10)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(var(--accent-cyan))]">
              <Icon name="bolt" size={12} filled />
              {t("results.cacheBadge")}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <h1 className="max-w-3xl text-[clamp(28px,3.2vw,40px)] font-semibold leading-tight tracking-tight text-on-surface">
            {heading}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <DownloadButton
              resultId={resultId}
              scenario={scenario}
              modelId={modelId}
              result={result}
              retrievedChunks={retrievedChunks}
            />
            <ShareButton
              onClick={shareAnalysis}
              disabled={creatingShare}
              loading={creatingShare}
              label={t("results.sharePublicly")}
            />
            <button
              type="button"
              onClick={continueInChat}
              disabled={creatingChat}
              className="btn-primary"
            >
              {creatingChat ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>{t("results.starting")}</span>
                </>
              ) : (
                <>
                  <span>{t("results.continueInChat")}</span>
                  <Icon name="arrow_forward" size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Scenario context */}
      <section className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.scenarioLabel")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-on-surface">
          {scenario}
        </p>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.modelLabel")}{" "}
          <span className="font-normal normal-case tracking-normal text-on-surface-variant">
            {getModelTierLabel(modelId)}
          </span>
        </p>
      </section>

      {/* Confidence */}
      <ConfidenceExplainer
        level={result.confidenceLevel}
        reason={result.confidenceReason}
        retrieval={retrieval ?? null}
        parsedOk={result.confidenceLevel !== "NEEDS_REVIEW"}
      />

      {/* Clarifying / civil */}
      {result.needsClarification && result.clarifyingQuestions?.length ? (
        <section className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {t("results.clarifyingQuestions")}
          </h3>
          <ol className="mt-2 list-decimal pl-5 text-[14px] leading-relaxed text-on-surface">
            {result.clarifyingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {result.isCivilMatter && result.civilExplanation ? (
        <section className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {t("results.civilExplanation")}
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-on-surface">
            {result.civilExplanation}
          </p>
        </section>
      ) : null}

      {/* Seven-step timeline */}
      <section
        aria-label="Seven-step analysis"
        className="relative mx-auto w-full max-w-[820px]"
      >
        <div
          className="absolute bottom-0 left-[15px] top-0 z-0 w-px bg-[rgb(var(--border-subtle))]"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-4">
          {STEPS.map((entry, idx) => {
            const value = result[entry.field];
            const text = typeof value === "string" ? value : "—";
            const title = cleanStepTitle(t(entry.i18nKey));
            return (
              <StepCard
                key={entry.field}
                number={idx + 1}
                title={title}
                body={text}
                highlight={idx === STEPS.length - 1}
              />
            );
          })}
        </div>
      </section>

      {/* Punishment + procedural roadmap */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <article className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6 md:col-span-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[rgb(var(--surface-overlay))] text-[rgb(var(--accent-cyan))]">
              <Icon name="balance" size={16} filled />
            </span>
            <h2 className="text-[18px] font-semibold tracking-tight text-on-surface">
              {t("results.estimatedPunishment")}
            </h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-on-surface">
            {result.estimatedPunishment}
          </p>
          {maxSim > 0 ? (
            <p className="mt-4 border-t border-[rgb(var(--border-subtle))] pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {t("results.bestRetrievalSimilarity") || "Best retrieval similarity"}{" "}
              <span className="tabular-nums text-[rgb(var(--accent-cyan))]">
                {(maxSim * 100).toFixed(1)}%
              </span>
            </p>
          ) : null}
        </article>

        <article className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5 sm:p-6 md:col-span-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[rgb(var(--surface-overlay))] text-[rgb(var(--accent-cyan))]">
              <Icon name="route" size={16} filled />
            </span>
            <h2 className="text-[18px] font-semibold tracking-tight text-on-surface">
              {t("results.proceduralRoadmap")}
            </h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">
            {result.proceduralRoadmap}
          </p>
        </article>
      </section>

      {/* Sources */}
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[20px] font-semibold tracking-tight text-on-surface">
            {t("results.sources")}
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant tabular-nums">
            {retrievedChunks.length}{" "}
            {retrievedChunks.length === 1
              ? t("results.sourcesCountOne")
              : t("results.sourcesCountOther")}
          </span>
        </div>
        <SourcesPanel
          chunks={retrievedChunks}
          onOpenChunk={(c) => setOpenChunk(c)}
          layout="flat"
        />
      </section>

      {/* Suggested follow-ups */}
      {result.suggestedFollowUps && result.suggestedFollowUps.length > 0 ? (
        <SuggestedQuestions
          questions={result.suggestedFollowUps}
          analysisId={resultId}
          scenarioDescription={scenario}
          modelId={modelId}
        />
      ) : null}

      {/* Disclaimer */}
      <section className="rounded-[12px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface))] px-5 py-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.disclaimer")}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-on-surface-variant">
          {result.disclaimer}
        </p>
      </section>

      <FeedbackWidget analysisId={resultId} />

      {/* Lawyer cards */}
      {lawyers.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-[20px] font-semibold tracking-tight text-on-surface">
            {t("resources.title")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lawyers.map((r) => (
              <LawyerCard key={r.name} resource={r} />
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => setError(null)} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border-subtle))] pt-6">
        <button
          type="button"
          onClick={() => router.push(`/compare?a=${resultId}`)}
          className="btn-secondary"
        >
          <Icon name="compare_arrows" size={14} />
          <span>{t("results.compareWith")}</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="btn-ghost"
        >
          {t("results.newAnalysis")}
        </button>
      </div>

      <ArticlePanel chunk={openChunk} onClose={() => setOpenChunk(null)} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
