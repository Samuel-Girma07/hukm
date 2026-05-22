"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AnalysisProgress } from "./AnalysisProgress";
import { CrimeSelector } from "./CrimeSelector";
import { ErrorState, InlineError } from "./ErrorState";
import { Icon } from "./Icon";
import { Kbd } from "./Kbd";
import { LanguageToggle } from "./LanguageToggle";
import { ModelSelector } from "./ModelSelector";
import { ScenarioSliders } from "./ScenarioSliders";
import { Spinner } from "./Spinner";
import BorderGlow from "./BorderGlow";

import { useLanguage } from "@/contexts/LanguageContext";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { parseSSEStream, type StreamPhase } from "@/lib/streaming";
import type {
  CrimeCategory,
  Language,
  ScenarioContext,
} from "@/lib/types";

const SCENARIO_MIN = 10;
const SCENARIO_MAX = 5000;

export function ScenarioForm(): React.ReactElement {
  const router = useRouter();
  const { language: uiLanguage, t } = useLanguage();

  const [scenario, setScenario] = useState("");
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [responseLanguage, setResponseLanguage] = useState<Language>(uiLanguage);
  const [crimeCategory, setCrimeCategory] = useState<CrimeCategory | "">("");
  const [scenarioContext, setScenarioContext] = useState<ScenarioContext>({
    severity: 3,
    intent: 3,
    history: 1,
  });

  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phase, setPhase] = useState<StreamPhase>("retrieving");
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [cancelling, setCancelling] = useState(false);
  const [focused, setFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedLength = scenario.trim().length;
  const tooShort = trimmedLength > 0 && trimmedLength < SCENARIO_MIN;
  const tooLong = trimmedLength > SCENARIO_MAX;

  const examples = [
    { label: t("home.example1Label"), text: t("home.example1Text"), icon: "gavel" },
    { label: t("home.example2Label"), text: t("home.example2Text"), icon: "warning" },
    { label: t("home.example3Label"), text: t("home.example3Text"), icon: "balance" },
  ];

  // Global keyboard shortcuts:
  //   "/"  → focus the scenario textarea (unless already typing somewhere)
  //   Esc  → cancel an in-flight analysis
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false);

      if (event.key === "/" && !inField && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
      if (event.key === "Escape" && submitting) {
        event.preventDefault();
        abortRef.current?.abort();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitting]);

  function handleExample(text: string): void {
    setScenario(text);
    setValidationError(null);
    textareaRef.current?.focus();
  }

  function handleTextareaKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      !submitting
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  // Step keys the model emits as JSON object keys, in order.
  const STEP_KEYS = [
    "step1FactIdentification",
    "step2LegalClassification",
    "step3ElementsAnalysis",
    "step4DefensesAndMitigation",
    "step5SentencingFramework",
    "step6PrecedentApplication",
    "step7Conclusion",
  ] as const;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSubmitError(null);
    setValidationError(null);

    if (trimmedLength < SCENARIO_MIN) {
      setValidationError(t("form.scenarioMinError", { min: SCENARIO_MIN }));
      return;
    }
    if (trimmedLength > SCENARIO_MAX) {
      setValidationError(t("form.scenarioMaxError", { max: SCENARIO_MAX }));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true);
    setPhase("retrieving");
    setStepIndex(-1);
    setCancelling(false);

    try {
      const response = await fetch("/api/analyze?stream=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify({
          scenario: scenario.trim(),
          modelId,
          language: responseLanguage,
          crimeCategory: crimeCategory || undefined,
          scenarioContext,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSubmitError(
          data?.error ?? `Request failed with status ${response.status}.`,
        );
        return;
      }

      let resultId: string | null = null;
      let buffer = "";
      let highestStepSeen = -1;

      for await (const ev of parseSSEStream(response)) {
        if (ev.type === "phase") {
          setPhase(ev.phase);
        } else if (ev.type === "token") {
          buffer += ev.content;
          for (let i = highestStepSeen + 1; i < STEP_KEYS.length; i += 1) {
            if (buffer.includes(STEP_KEYS[i]!)) {
              highestStepSeen = i;
              setStepIndex(i);
            } else {
              break;
            }
          }
          if (highestStepSeen >= 6) setPhase("synthesizing");
        } else if (ev.type === "done") {
          if (typeof ev.resultId === "string") resultId = ev.resultId;
          setStepIndex(STEP_KEYS.length);
        } else if (ev.type === "error") {
          setSubmitError(ev.error);
          return;
        }
      }

      if (resultId) {
        router.push(`/results/${resultId}`);
      } else {
        setSubmitError("Analysis completed but no result id was returned.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setSubmitError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error.",
      );
    } finally {
      abortRef.current = null;
      setSubmitting(false);
      setCancelling(false);
    }
  }

  function handleCancel(): void {
    setCancelling(true);
    abortRef.current?.abort();
    setSubmitting(false);
    setCancelling(false);
  }

  const sendDisabled =
    submitting || trimmedLength < SCENARIO_MIN || tooLong;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* ───────────── Composer card with BorderGlow ───────────── */}
      <div className="flex flex-col gap-2">
        <label htmlFor="scenario" className="sr-only">
          {t("form.scenarioLabel")}
        </label>
        <div
          className={`transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-[rgb(var(--focus))] ${tooLong || tooShort ? "border-[rgb(var(--accent-red)/0.5)] focus-within:border-[rgb(var(--accent-red))]" : ""}`}
        >
          <BorderGlow
            backgroundColor="rgb(28, 28, 30)"
            borderRadius={18}
            glowRadius={20}
            glowIntensity={0.8}
            edgeSensitivity={25}
            coneSpread={20}
            colors={['#5AC8FA', '#0A84FF', '#c084fc']}
            focused={focused}
            className="w-full"
          >
            <textarea
              id="scenario"
              name="scenario"
              ref={textareaRef}
              rows={5}
              className="
                w-full resize-none rounded-t-[18px]
                border-none bg-transparent
                px-5 pt-4 pb-2
                text-[15px] leading-relaxed text-on-surface
                placeholder:text-[rgb(var(--text-muted))]
                focus:outline-none focus:ring-0
                min-h-[140px]
              "
              placeholder={t("form.scenarioPlaceholder")}
              value={scenario}
              onChange={(event) => setScenario(event.currentTarget.value)}
              onKeyDown={handleTextareaKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={submitting}
              maxLength={SCENARIO_MAX + 50}
              aria-describedby="scenario-counter"
              aria-invalid={tooShort || tooLong || undefined}
              required
            />

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-t border-[rgb(var(--border-subtle))] px-2 py-1.5">
              <CrimeSelector
                value={crimeCategory}
                onChange={setCrimeCategory}
                disabled={submitting}
                hideHint
                variant="compact"
              />
              <ScenarioSliders
                value={scenarioContext}
                onChange={setScenarioContext}
                disabled={submitting}
              />
              <LanguageToggle
                value={responseLanguage}
                onChange={setResponseLanguage}
                disabled={submitting}
                variant="compact"
                ariaLabel={t("form.languageLabel")}
              />

              <div className="ml-auto flex items-center gap-1.5">
                <ModelSelector
                  value={modelId}
                  onChange={setModelId}
                  disabled={submitting}
                  hideHint
                  variant="compact"
                />
                <span
                  id="scenario-counter"
                  className={`hidden tabular-nums text-[11px] font-medium sm:inline ${
                    tooLong || tooShort
                      ? "text-[rgb(var(--accent-red))]"
                      : "text-on-surface-variant/70"
                  }`}
                  aria-live="polite"
                >
                  {trimmedLength.toLocaleString()}/{SCENARIO_MAX.toLocaleString()}
                </span>
                {submitting ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="
                      inline-flex h-9 w-9 items-center justify-center rounded-full
                      bg-[rgb(var(--surface-overlay))] text-on-surface-variant
                      transition-colors duration-150 ease-out
                      hover:bg-[rgb(var(--surface-active))] hover:text-on-surface
                    "
                    aria-label={t("common.cancel")}
                    aria-keyshortcuts="Escape"
                  >
                    <Icon name="close" size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={sendDisabled}
                    aria-label={t("composer.send")}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                    className="
                      inline-flex h-9 w-9 items-center justify-center rounded-full
                      bg-white text-[#0A0A0A]
                      transition-[background-color,transform] duration-150 ease-out
                      hover:bg-[#EBEBF5]
                      motion-safe:active:scale-95
                      disabled:cursor-not-allowed
                      disabled:bg-[rgb(var(--surface-overlay))]
                      disabled:text-on-surface-variant
                    "
                  >
                    <Icon name="send" size={14} filled />
                  </button>
                )}
              </div>
            </div>
          </BorderGlow>
        </div>

        {validationError ? <InlineError message={validationError} /> : null}
        {submitError ? (
          <ErrorState
            message={submitError}
            onRetry={() => setSubmitError(null)}
          />
        ) : null}

        {submitting ? (
          <AnalysisProgress
            phase={phase}
            stepIndex={stepIndex}
            cancelling={cancelling}
          />
        ) : null}

        {/* Disclaimer */}
        <p className="mt-1 flex items-start gap-2 text-center text-[12px] leading-snug text-on-surface-variant">
          <Icon name="info" size={12} className="mt-0.5 shrink-0" />
          <span>{t("form.disclaimerInline")}</span>
        </p>

        {/* Hint */}
        {!submitting ? (
          <p className="text-center text-[11px] text-on-surface-variant/70">
            {t("home.runAnalysisHint")}{" "}
            <Kbd>⌘</Kbd> <Kbd>Enter</Kbd>
          </p>
        ) : (
          <p className="text-center text-[11px] text-on-surface-variant/70">
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="h-3 w-3" /> {t("home.analysing")}
            </span>
          </p>
        )}
      </div>

      {/* ───────────── Suggestions grid ───────────── */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {t("composer.suggestionsHeading")}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {examples.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={submitting}
              onClick={() => handleExample(example.text)}
              className="
                group flex items-start gap-3 rounded-[14px]
                border border-[rgb(var(--border-subtle))]
                bg-[rgb(var(--surface-elevated))]
                px-4 py-3 text-left
                transition-[background-color,border-color,transform] duration-150 ease-out
                hover:bg-[rgb(var(--surface-overlay))]
                hover:border-[rgb(var(--border-visible))]
                motion-safe:hover:-translate-y-px
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[rgb(var(--surface-overlay))] text-on-surface-variant transition-colors group-hover:text-[rgb(var(--accent-cyan))]">
                <Icon name={example.icon} size={14} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-on-surface">
                  {example.label}
                </span>
                <span className="line-clamp-2 text-[12px] leading-snug text-on-surface-variant">
                  {example.text}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
