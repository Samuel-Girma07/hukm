"use client";

import { Icon } from "./Icon";

import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/types";

interface LanguageToggleProps {
  /**
   * Controlled value. When omitted the toggle drives the global
   * `LanguageContext`. When provided, the toggle is "one-shot" for a
   * form field (e.g. "Respond in …") without changing the UI language.
   */
  value?: Language;
  onChange?: (language: Language) => void;
  disabled?: boolean;
  variant?: "labelled" | "compact";
  ariaLabel?: string;
}

export function LanguageToggle({
  value,
  onChange,
  disabled = false,
  variant = "labelled",
  ariaLabel,
}: LanguageToggleProps): React.ReactElement {
  const ctx = useLanguage();
  const isControlled =
    typeof value !== "undefined" && typeof onChange === "function";
  const current: Language = isControlled ? (value as Language) : ctx.language;
  const setValue = (next: Language): void => {
    if (isControlled) onChange?.(next);
    else ctx.setLanguage(next);
  };

  if (variant === "compact") {
    const next: Language = current === "en" ? "am" : "en";
    return (
      <button
        type="button"
        onClick={() => setValue(next)}
        disabled={disabled}
        aria-label={ariaLabel ?? ctx.t("nav.toggleLanguage")}
        title={ariaLabel ?? ctx.t("nav.toggleLanguage")}
        className="
          inline-flex h-9 items-center gap-1.5 rounded-full
          px-2.5 text-on-surface-variant
          transition-colors duration-150 ease-out
          hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]
        "
      >
        <Icon name="translate" size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">
          {current === "en" ? "EN" : "አማ"}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="label mb-0">{ctx.t("form.languageLabel")}</span>
      <div
        role="radiogroup"
        aria-label={ariaLabel ?? ctx.t("form.languageLabel")}
        className="inline-flex items-center rounded-full border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-overlay))] p-0.5"
      >
        <ToggleButton
          active={current === "en"}
          disabled={disabled}
          onClick={() => setValue("en")}
        >
          {ctx.t("form.languageEnglish")}
        </ToggleButton>
        <ToggleButton
          active={current === "am"}
          disabled={disabled}
          onClick={() => setValue("am")}
        >
          {ctx.t("form.languageAmharic")}
        </ToggleButton>
      </div>
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToggleButton({
  active,
  disabled,
  onClick,
  children,
}: ToggleButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? "rounded-full bg-[rgb(var(--accent-blue))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors duration-150 disabled:opacity-50"
          : "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant transition-colors duration-150 hover:text-on-surface disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
