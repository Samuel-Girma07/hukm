"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import { InfoHint } from "./InfoHint";

import { useT } from "@/contexts/LanguageContext";
import { CRIME_CATEGORIES } from "@/lib/crimeCategories";
import type { CrimeCategory } from "@/lib/types";

interface CrimeSelectorProps {
  value: CrimeCategory | "";
  onChange: (next: CrimeCategory | "") => void;
  disabled?: boolean;
  id?: string;
  hideHint?: boolean;
  /**
   * `card` (default) renders a labelled select; `compact` renders an
   * inline pill trigger with a popover, matching the composer toolbar.
   */
  variant?: "card" | "compact";
}

export function CrimeSelector({
  value,
  onChange,
  disabled = false,
  id = "crime-category",
  hideHint = false,
  variant = "card",
}: CrimeSelectorProps): React.ReactElement {
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

  const selectedLabel =
    value === ""
      ? t("composer.focusAll")
      : t(
          `crimeCategory.${
            CRIME_CATEGORIES.find((c) => c.id === value)?.i18nKey ?? ""
          }`,
        );

  if (variant === "compact") {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
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
          <Icon name="flag" size={14} />
          <span className="max-w-[140px] truncate">
            {value === ""
              ? t("composer.focusLabel")
              : selectedLabel}
          </span>
          <Icon
            name="expand_more"
            size={14}
            className="text-on-surface-variant"
          />
        </button>
        {open ? (
          <div className="absolute left-0 bottom-[calc(100%+0.5rem)] z-30 w-[280px] rounded-[12px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] shadow-[0_8px_32px_rgba(0,0,0,0.55)] motion-safe:animate-popIn">
            <ul role="listbox" className="max-h-[320px] overflow-y-auto p-2 scrollbar-slim">
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ""}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-[rgb(var(--surface-overlay))] ${
                    value === "" ? "text-on-surface" : "text-on-surface-variant"
                  }`}
                >
                  <span>{t("composer.focusAll")}</span>
                  {value === "" ? (
                    <Icon
                      name="check"
                      size={14}
                      className="text-[rgb(var(--accent-blue))]"
                    />
                  ) : null}
                </button>
              </li>
              {CRIME_CATEGORIES.map((cat) => {
                const active = value === cat.id;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(cat.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-[rgb(var(--surface-overlay))] ${
                        active ? "text-on-surface" : "text-on-surface-variant"
                      }`}
                    >
                      <span>{t(`crimeCategory.${cat.i18nKey}`)}</span>
                      {active ? (
                        <Icon
                          name="check"
                          size={14}
                          className="text-[rgb(var(--accent-blue))]"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="label inline-flex items-center gap-1.5">
        {t("form.crimeCategoryLabel")}
        <InfoHint label={t("form.crimeCategoryLabel")}>
          {t("form.crimeCategoryTip")}
        </InfoHint>
      </label>
      <div className="relative">
        <select
          id={id}
          className="select appearance-none pr-10"
          value={value}
          onChange={(event) => {
            const next = event.currentTarget.value as CrimeCategory | "";
            onChange(next);
          }}
          disabled={disabled}
        >
          <option value="">{t("form.crimeCategoryPlaceholder")}</option>
          {CRIME_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {t(`crimeCategory.${cat.i18nKey}`)}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
      </div>
      {hideHint ? null : <p className="help">{t("form.crimeCategoryHint")}</p>}
    </div>
  );
}
