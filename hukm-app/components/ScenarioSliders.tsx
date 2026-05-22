"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import { InfoHint } from "./InfoHint";

import { useT } from "@/contexts/LanguageContext";
import type { ScenarioContext } from "@/lib/types";

interface ScenarioSlidersProps {
  value: ScenarioContext;
  onChange: (next: ScenarioContext) => void;
  disabled?: boolean;
}

const AXES = [
  {
    id: "severity" as const,
    labelKey: "form.severityLabel",
    helpKey: "form.severityHelp",
    tipKey: "form.severityTip",
    valueKeyBase: "form.severity",
    defaultValue: 3,
    minLabel: "Minor",
    maxLabel: "Aggravated",
  },
  {
    id: "intent" as const,
    labelKey: "form.intentLabel",
    helpKey: "form.intentHelp",
    tipKey: "form.intentTip",
    valueKeyBase: "form.intent",
    defaultValue: 3,
    minLabel: "Accidental",
    maxLabel: "Premeditated",
  },
  {
    id: "history" as const,
    labelKey: "form.historyLabel",
    helpKey: "form.historyHelp",
    tipKey: "form.historyTip",
    valueKeyBase: "form.history",
    defaultValue: 1,
    minLabel: "First Offense",
    maxLabel: "Habitual",
  },
];

/**
 * Advanced-options popover anchored to a compact toolbar trigger.
 *
 * Three horizontal sliders (severity / intent / history) with muted
 * labels and a blue accent track. State shape unchanged:
 *   { severity, intent, history }
 */
export function ScenarioSliders({
  value,
  onChange,
  disabled = false,
}: ScenarioSlidersProps): React.ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="
          inline-flex items-center gap-1.5 rounded-full
          px-2.5 py-1.5 text-[12px] font-medium text-on-surface-variant
          transition-colors duration-150 ease-out
          hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface
          disabled:cursor-not-allowed disabled:opacity-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]
        "
      >
        <Icon name="tune" size={14} />
        <span>{t("composer.advanced")}</span>
        <Icon
          name="expand_more"
          size={14}
          className="text-on-surface-variant"
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("composer.advanced")}
          className="absolute right-0 bottom-[calc(100%+0.5rem)] z-30 w-[320px] rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] shadow-[0_8px_32px_rgba(0,0,0,0.55)] motion-safe:animate-popIn"
        >
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-subtle))] px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {t("composer.advanced")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {t("composer.advancedClose")}
            </button>
          </div>
          <div className="space-y-5 px-4 py-4">
            {AXES.map((axis) => {
              const current = value[axis.id] ?? axis.defaultValue;
              const valueKey = `${axis.valueKeyBase}${current}`;
              return (
                <div key={axis.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`slider-${axis.id}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                    >
                      {t(axis.labelKey)}
                      <InfoHint label={t(axis.labelKey)}>
                        {t(axis.tipKey)}
                      </InfoHint>
                    </label>
                    <span className="inline-flex items-center rounded-full border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-overlay))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface">
                      {t(valueKey)}
                    </span>
                  </div>
                  <input
                    id={`slider-${axis.id}`}
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={current}
                    onChange={(event) => {
                      const next = Number(event.currentTarget.value);
                      onChange({ ...value, [axis.id]: next });
                    }}
                    disabled={disabled}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[rgb(var(--surface-overlay))] accent-[rgb(var(--accent-blue))]"
                    aria-label={t(axis.labelKey)}
                  />
                  <div className="flex justify-between text-[10px] text-on-surface-variant/70">
                    <span>{axis.minLabel}</span>
                    <span>{axis.maxLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
