"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { ErrorState, InlineError } from "./ErrorState";
import { Icon } from "./Icon";
import { ModelSelector } from "./ModelSelector";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import { DEFAULT_MODEL_ID, getModelTierLabel } from "@/lib/models";
import type {
  AnalysisResult,
  AnalyzeResponse,
  ConfidenceLevel,
  LawChunk,
} from "@/lib/types";

interface SideState {
  scenario: string;
  loading: boolean;
  error: string | null;
  result: AnalysisResult | null;
  resultId: string | null;
  modelId: string | null;
  retrievedChunks: LawChunk[];
}

interface SingleResultResponse {
  success: true;
  id: string;
  result: AnalysisResult;
  retrievedChunks?: LawChunk[];
  modelId: string;
  scenarioInput: { scenario?: string } | null;
}

const SCENARIO_MIN = 10;
const SCENARIO_MAX = 5000;

const initial: SideState = {
  scenario: "",
  loading: false,
  error: null,
  result: null,
  resultId: null,
  modelId: null,
  retrievedChunks: [],
};

export function CompareView(): React.ReactElement {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [a, setA] = useState<SideState>(initial);
  const [b, setB] = useState<SideState>(initial);
  const [validation, setValidation] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const idA = searchParams?.get("a");
    const idB = searchParams?.get("b");
    if (idA) {
      setA((prev) => ({ ...prev, loading: true, error: null }));
      void loadExisting(idA).then((side) => setA(side));
    }
    if (idB) {
      setB((prev) => ({ ...prev, loading: true, error: null }));
      void loadExisting(idB).then((side) => setB(side));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExisting(id: string): Promise<SideState> {
    try {
      const response = await fetch(`/api/results/${id}`);
      if (!response.ok) {
        return {
          ...initial,
          loading: false,
          error: `Could not load analysis (HTTP ${response.status}).`,
        };
      }
      const data = (await response.json()) as SingleResultResponse;
      return {
        ...initial,
        scenario: data.scenarioInput?.scenario ?? "",
        loading: false,
        result: data.result,
        resultId: data.id,
        modelId: data.modelId,
        retrievedChunks: data.retrievedChunks ?? [],
      };
    } catch (err) {
      return {
        ...initial,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function analyseSide(
    scenario: string,
  ): Promise<{ ok: true; side: SideState } | { ok: false; error: string }> {
    const trimmed = scenario.trim();
    if (trimmed.length < SCENARIO_MIN) {
      return {
        ok: false,
        error: t("form.scenarioMinError", { min: SCENARIO_MIN }),
      };
    }
    if (trimmed.length > SCENARIO_MAX) {
      return {
        ok: false,
        error: t("form.scenarioMaxError", { max: SCENARIO_MAX }),
      };
    }
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: trimmed, modelId, language: "en" }),
      });
      const data = (await response.json().catch(() => null)) as
        | AnalyzeResponse
        | null;
      if (!response.ok || !data || !data.success) {
        const msg =
          data && !data.success && "error" in data
            ? data.error
            : `HTTP ${response.status}`;
        return { ok: false, error: msg };
      }
      return {
        ok: true,
        side: {
          scenario: trimmed,
          loading: false,
          error: null,
          result: data.result,
          resultId: data.resultId,
          modelId: data.modelId,
          retrievedChunks: data.retrievedChunks,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function runBoth(): Promise<void> {
    setValidation(null);
    if (
      a.scenario.trim().length < SCENARIO_MIN ||
      b.scenario.trim().length < SCENARIO_MIN
    ) {
      setValidation(t("compare.needBoth"));
      return;
    }
    setA((prev) => ({ ...prev, loading: true, error: null, result: null }));
    setB((prev) => ({ ...prev, loading: true, error: null, result: null }));
    const [resA, resB] = await Promise.all([
      analyseSide(a.scenario),
      analyseSide(b.scenario),
    ]);
    if (resA.ok) setA(resA.side);
    else setA((prev) => ({ ...prev, loading: false, error: resA.error }));
    if (resB.ok) setB(resB.side);
    else setB((prev) => ({ ...prev, loading: false, error: resB.error }));
    if (resA.ok && resB.ok) {
      const params = new URLSearchParams();
      params.set("a", resA.side.resultId ?? "");
      params.set("b", resB.side.resultId ?? "");
      router.replace(`/compare?${params.toString()}`);
    }
  }

  async function exportComparison(): Promise<void> {
    if (!a.result || !b.result) return;
    setExporting(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ComparisonPDF } = await import("./ComparisonPDF");
      const blob = await pdf(
        <ComparisonPDF
          left={{
            scenario: a.scenario,
            result: a.result,
            retrievedChunks: a.retrievedChunks,
            modelId: a.modelId ?? modelId,
          }}
          right={{
            scenario: b.scenario,
            result: b.result,
            retrievedChunks: b.retrievedChunks,
            modelId: b.modelId ?? modelId,
          }}
          generatedAt={new Date().toISOString().slice(0, 10)}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const aEl = document.createElement("a");
      aEl.href = url;
      aEl.download = `HUKM-Comparison-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(aEl);
      aEl.click();
      document.body.removeChild(aEl);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const sameConfidence =
    a.result && b.result && a.result.confidenceLevel === b.result.confidenceLevel;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          {t("nav.compare")}
        </p>
        <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          {t("compare.title")}
        </h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
          {t("compare.subtitle")}
        </p>
      </header>

      <div className="mx-auto w-full max-w-sm">
        <ModelSelector
          value={modelId}
          onChange={setModelId}
          disabled={a.loading || b.loading}
          hideHint
          variant="card"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SideEditor
          badge="A"
          label={t("compare.scenarioA")}
          value={a.scenario}
          onChange={(v) => setA((prev) => ({ ...prev, scenario: v }))}
          disabled={a.loading || b.loading}
        />
        <SideEditor
          badge="B"
          label={t("compare.scenarioB")}
          value={b.scenario}
          onChange={(v) => setB((prev) => ({ ...prev, scenario: v }))}
          disabled={a.loading || b.loading}
        />
      </div>

      {validation ? <InlineError message={validation} /> : null}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void runBoth()}
          disabled={a.loading || b.loading}
          className="btn-primary"
        >
          {a.loading || b.loading ? (
            <>
              <Spinner className="h-4 w-4" />
              <span>{t("compare.analysing")}</span>
            </>
          ) : (
            <>
              <Icon name="analytics" size={14} />
              <span>{t("compare.analyseBoth")}</span>
            </>
          )}
        </button>
        {a.result && b.result ? (
          <button
            type="button"
            onClick={() => void exportComparison()}
            disabled={exporting}
            className="btn-secondary"
          >
            {exporting ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>{t("compare.exportingComparison")}</span>
              </>
            ) : (
              <>
                <Icon name="picture_as_pdf" size={14} />
                <span>{t("compare.exportComparison")}</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {(a.result || b.result) && (
        <>
          <div className="border-t border-[rgb(var(--border-subtle))]" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SideResult side={a} />
            <SideResult side={b} />
          </div>

          {a.result && b.result ? (
            <section className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]">
              <div
                className={`flex items-center gap-3 px-5 py-4 text-[14px] leading-relaxed ${
                  sameConfidence
                    ? "text-[rgb(var(--accent-green))]"
                    : "text-on-surface"
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    sameConfidence
                      ? "bg-[rgb(var(--accent-green)/0.15)] text-[rgb(var(--accent-green))]"
                      : "bg-[rgb(var(--accent-amber)/0.15)] text-[rgb(var(--accent-amber))]"
                  }`}
                  aria-hidden
                >
                  <Icon
                    name={sameConfidence ? "check_circle" : "warning"}
                    size={16}
                    filled
                  />
                </span>
                <span>
                  {sameConfidence
                    ? t("compare.sameConfidence")
                    : t("compare.differentConfidence")}
                </span>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

interface SideEditorProps {
  badge: "A" | "B";
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function SideEditor({
  badge,
  label,
  value,
  onChange,
  disabled,
}: SideEditorProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-on-surface">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--accent-blue)/0.45)] bg-[rgb(var(--accent-blue)/0.12)] text-[12px] font-semibold text-[rgb(var(--accent-blue))]">
          {badge}
        </span>
        {label}
      </label>
      <div className="flex flex-col rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] focus-within:border-[rgb(var(--focus))]">
        <textarea
          rows={6}
          className="min-h-[180px] resize-none border-none bg-transparent p-4 text-[15px] leading-relaxed text-on-surface placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-0"
          placeholder="Enter scenario facts, charges, and circumstances…"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          maxLength={SCENARIO_MAX + 50}
        />
        <div className="flex items-center justify-end px-4 py-2 text-[11px] font-medium tabular-nums text-on-surface-variant/70">
          {value.length} / {SCENARIO_MAX.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

interface SideResultProps {
  side: SideState;
}

function SideResult({ side }: SideResultProps): React.ReactElement | null {
  const t = useT();
  if (side.loading) {
    return (
      <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5">
        <div className="skeleton h-5 w-32" />
        <div className="mt-3 skeleton h-4 w-full" />
        <div className="mt-2 skeleton h-4 w-3/4" />
      </div>
    );
  }
  if (side.error) return <ErrorState message={side.error} />;
  if (!side.result) return null;

  const level: ConfidenceLevel = side.result.confidenceLevel;

  const sections = [
    { title: "Classification", body: side.result.step2LegalClassification, open: true },
    { title: "Sentencing framework", body: side.result.step5SentencingFramework, open: false },
    { title: "Conclusion", body: side.result.step7Conclusion, open: false },
  ];

  const accentClass =
    level === "HIGH"
      ? "bg-[rgb(var(--accent-green))]"
      : level === "MEDIUM"
        ? "bg-[rgb(var(--accent-cyan))]"
        : level === "LOW"
          ? "bg-[rgb(var(--accent-amber))]"
          : "bg-[rgb(var(--accent-red))]";

  return (
    <article className="flex flex-col gap-3">
      <ConfidenceBadge level={level} />

      <div className="overflow-hidden rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]">
        {sections.map((s, i) => (
          <details
            key={s.title}
            {...(s.open ? { open: true } : {})}
            className={`group ${
              i > 0 ? "border-t border-[rgb(var(--border-subtle))]" : ""
            }`}
          >
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 transition-colors duration-150 hover:bg-[rgb(var(--surface-overlay))] marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="text-[15px] font-semibold tracking-tight text-on-surface">
                {s.title}
              </span>
              <Icon
                name="expand_more"
                size={16}
                className="text-on-surface-variant transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <p className="px-5 pb-5 text-[14px] leading-relaxed text-on-surface-variant">
              {s.body}
            </p>
          </details>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5">
        <span
          aria-hidden
          className={`absolute left-0 top-0 h-full w-1 ${accentClass}`}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("results.estimatedPunishment")}
        </p>
        <p className="mt-2 text-[18px] font-semibold tracking-tight text-on-surface">
          {side.result.estimatedPunishment}
        </p>
        <p className="mt-2 text-[11px] font-medium text-on-surface-variant">
          Model:{" "}
          <span className="text-on-surface-variant/80">
            {side.modelId ? getModelTierLabel(side.modelId) : "—"}
          </span>
        </p>
      </div>
    </article>
  );
}
