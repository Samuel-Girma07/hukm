"use client";

import { useState, useRef, useEffect } from "react";

import { Icon } from "./Icon";

import { PRIMARY_MODELS, type ChatModel } from "@/lib/models";
import { useT } from "@/contexts/LanguageContext";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  hideHint?: boolean;
  variant?: "card" | "compact";
}

const MODEL_META: Record<
  string,
  { icon: React.ReactNode; badge?: string; badgeClass?: string; iconColor: string }
> = {
  "meta/llama-4-maverick-17b-128e-instruct": {
    icon: <Icon name="bolt" size={18} />,
    iconColor: "text-yellow-500",
  },
  "nvidia/nemotron-3-super-120b-a12b": {
    icon: <Icon name="psychology" size={18} />,
    iconColor: "text-orange-400",
  },
  "qwen/qwen3.5-397b-a17b": {
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    iconColor: "text-cyan-400",
    badge: "Most Popular",
    badgeClass:
      "text-[10px] font-semibold text-[rgb(var(--accent-blue))] bg-[rgb(var(--accent-blue))]/10 px-1.5 py-0.5 rounded-full border border-[rgb(var(--accent-blue))]/20",
  },
  "openai/gpt-oss-120b": {
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    iconColor: "text-cyan-500",
  },
  "z-ai/glm-5.1": {
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    iconColor: "text-cyan-600",
    badge: "Premium",
    badgeClass:
      "text-[9px] uppercase tracking-wider font-bold text-indigo-300 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 px-2 py-0.5 rounded-full border border-indigo-500/30",
  },
};

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  variant = "card",
}: ModelSelectorProps): React.ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected =
    PRIMARY_MODELS.find((m) => m.id === value) ?? PRIMARY_MODELS[0]!;

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [open]);

  if (variant === "compact") {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="
            inline-flex items-center gap-1 rounded-[8px]
            border border-[rgb(var(--border-subtle))]
            bg-[rgb(var(--surface-elevated))]
            px-2.5 py-1.5 text-[12px] text-on-surface-variant
            transition-colors hover:text-on-surface
            disabled:cursor-not-allowed disabled:opacity-50
          "
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={MODEL_META[selected.id]?.iconColor ?? ""}>
            {MODEL_META[selected.id]?.icon ?? <Icon name="model" size={14} />}
          </span>
          <span className="hidden sm:inline">{selected.displayName}</span>
          <Icon name="expand_more" size={14} />
        </button>

        {open ? (
          <div
            className="
              absolute left-0 bottom-[calc(100%+6px)] z-50
              w-[260px] rounded-[12px] border border-[rgb(var(--border-subtle))]
              bg-[rgb(var(--surface-elevated))] shadow-xl
              p-1.5 space-y-0.5
            "
            role="listbox"
            aria-label={t("composer.model")}
          >
            {PRIMARY_MODELS.map((model) => (
              <ModelOption
                key={model.id}
                model={model}
                selected={value === model.id}
                compact
                onSelect={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-2 space-y-1">
      {PRIMARY_MODELS.map((model) => (
        <ModelOption
          key={model.id}
          model={model}
          selected={value === model.id}
          onSelect={() => onChange(model.id)}
        />
      ))}
    </div>
  );
}

function ModelOption({
  model,
  selected,
  compact = false,
  onSelect,
}: {
  model: ChatModel;
  selected: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  const meta = MODEL_META[model.id];

  return (
    <label
      role="option"
      aria-selected={selected}
      className={`
        flex items-center gap-3 rounded-xl cursor-pointer
        transition-colors duration-200 group
        ${compact ? "p-2" : "p-3"}
        ${selected
          ? "bg-[rgb(var(--accent-blue))]/10 border border-[rgb(var(--accent-blue))]/30"
          : "hover:bg-[rgb(var(--surface-overlay))]"
        }
      `}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <input
          type="radio"
          name="model_selection"
          value={model.id}
          checked={selected}
          onChange={onSelect}
          className="peer sr-only"
        />
        <div
          className={`
            rounded-full border-2 transition-all
            flex items-center justify-center
            ${compact ? "w-4 h-4" : "w-5 h-5"}
            ${selected
              ? "border-[rgb(var(--accent-blue))] bg-[rgb(var(--accent-blue))]"
              : "border-gray-500 peer-checked:border-[rgb(var(--accent-blue))] peer-checked:bg-[rgb(var(--accent-blue))]"
            }
          `}
        >
          <div
            className={`rounded-full bg-white transition-opacity ${compact ? "w-1.5 h-1.5" : "w-2 h-2"} ${selected ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      </div>

      <div className="flex-1 flex items-start gap-2 min-w-0">
        <div className={`mt-0.5 shrink-0 ${meta?.iconColor ?? "text-on-surface-variant"}`}>
          {meta?.icon ?? <Icon name="model" size={compact ? 16 : 20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`
                font-medium transition-colors truncate
                ${selected ? "text-white font-bold" : "text-on-surface group-hover:text-white"}
                ${compact ? "text-[13px]" : "text-[14px]"}
              `}
            >
              {model.displayName}
            </span>
            {meta?.badge ? (
              <span className={meta.badgeClass}>{meta.badge}</span>
            ) : null}
          </div>
          <p className={`text-on-surface-variant mt-0.5 leading-snug ${compact ? "text-[11px]" : "text-sm"}`}>
            {model.tagline}
          </p>
        </div>
      </div>
    </label>
  );
}
