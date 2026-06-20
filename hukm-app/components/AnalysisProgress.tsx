"use client";

import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import type { StreamPhase } from "@/lib/streaming";

export interface AnalysisProgressProps {
  /** Current pipeline phase emitted by the streaming endpoint. */
  phase: StreamPhase;
  /**
   * Index of the active 7-step prompt block, derived client-side by
   * scanning the streaming JSON for `step{N}` keys. -1 = LLM hasn't
   * started writing steps yet (still in "analyzing" warmup).
   */
  stepIndex: number;
  /** Whether the controller is currently aborting. */
  cancelling?: boolean;
}

/**
 * Compact dark status card while an analysis is streaming. Each step
 * transitions: idle → active (pulse) → done (check) with a quiet
 * cross-fade.
 *
 * The card is wrapped in a Google-color spinning gradient border.
 */
export function AnalysisProgress({
  phase,
  stepIndex,
  cancelling = false,
}: AnalysisProgressProps): React.ReactElement {
  const t = useT();

  const phaseLabel = (() => {
    switch (phase) {
      case "retrieving":
        return t("progress.retrieving");
      case "analyzing":
        return t("progress.analyzing");
      case "synthesizing":
        return t("progress.synthesizing");
      case "persisting":
        return t("progress.persisting");
    }
  })();

  const steps: string[] = [
    t("progress.step1"),
    t("progress.step2"),
    t("progress.step3"),
    t("progress.step4"),
    t("progress.step5"),
    t("progress.step6"),
    t("progress.step7"),
  ];

  return (
    <>

      <div className="hukm-progress-wrap">
        <section
          aria-live="polite"
          aria-busy
          className="hukm-progress-content flex flex-col gap-3 rounded-[12px] px-4 py-3 motion-safe:animate-softIn"
        >
          <header className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface">
              {cancelling ? t("progress.cancelling") : phaseLabel}
            </p>
            {!cancelling ? <Spinner className="h-4 w-4 text-[rgb(var(--accent-blue))]" /> : null}
          </header>

          <ol className="flex flex-col gap-1.5">
            {steps.map((label, i) => {
              const status: "done" | "active" | "idle" =
                i < stepIndex
                  ? "done"
                  : i === stepIndex || (stepIndex === -1 && i === 0 && phase === "analyzing")
                    ? "active"
                    : "idle";
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 text-[15px] leading-snug transition-colors duration-150"
                  aria-current={status === "active" ? "step" : undefined}
                >
                  <span
                    className={
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-150 " +
                      (status === "done"
                        ? "bg-[rgb(var(--accent-green))] text-[#0A0A0A]"
                        : status === "active"
                          ? "bg-[rgb(var(--accent-blue)/0.18)] ring-1 ring-[rgb(var(--accent-blue))]"
                          : "bg-[rgb(var(--surface-overlay))]")
                    }
                  >
                    {status === "done" ? (
                      <Icon name="check" size={12} filled />
                    ) : status === "active" ? (
                      <span className="block h-1.5 w-1.5 animate-pulseDot rounded-full bg-[rgb(var(--accent-blue))]" />
                    ) : (
                      <span className="block h-1 w-1 rounded-full bg-on-surface-variant/50" />
                    )}
                  </span>
                  <span
                    className={
                      status === "active"
                        ? "text-on-surface font-medium"
                        : status === "done"
                          ? "text-on-surface-variant line-through decoration-[rgb(var(--accent-green)/0.4)]"
                          : "text-on-surface-variant/70"
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}
