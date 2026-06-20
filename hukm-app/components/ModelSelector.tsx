"use client";

import { useState, useRef, useEffect } from "react";

import { Icon } from "./Icon";

import { PRIMARY_MODELS, type ChatModel, type ModelIcon } from "@/lib/models";
import { useT } from "@/contexts/LanguageContext";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  hideHint?: boolean;
  variant?: "card" | "compact";
}

/**
 * Per-model visual metadata. Keys MUST match the `id` field of models in
 * lib/models.ts PRIMARY_MODELS. To keep this in sync, we assert at module
 * load that every primary model has an entry — see PRIMARY_MODEL_IDS below.
 *
 * If you add a new model to PRIMARY_MODELS, add an entry here too.
 */
interface ModelVisualMeta {
  /** Tailwind text color class for the icon. */
  iconColor: string;
  /** Optional badge ("Most Popular", "Premium", etc.). */
  badge?: string;
  badgeClass?: string;
}

function iconForModel(icon: ModelIcon): React.ReactNode {
  // Map the abstract icon name from lib/models.ts to a concrete <Icon> name
  // or custom SVG. "speed" → lightning bolt, "brain" → thinking depth.
  switch (icon) {
    case "speed":
      return <Icon name="bolt" size={18} />;
    case "brain":
      return <Icon name="psychology" size={18} />;
    default:
      return <Icon name="model" size={18} />;
  }
}

const MODEL_META: Record<string, ModelVisualMeta> = {
  // ── Primary models (kept in sync with lib/models.ts PRIMARY_MODELS) ──
  "nvidia/nemotron-3-super-120b-a12b": {
    iconColor: "text-orange-400",
  },
  "moonshotai/kimi-k2.6": {
    iconColor: "text-cyan-400",
    badge: "Most Popular",
    badgeClass:
      "text-[10px] font-semibold text-[rgb(var(--accent-blue))] bg-[rgb(var(--accent-blue))]/10 px-1.5 py-0.5 rounded-full border border-[rgb(var(--accent-blue))]/20",
  },
  "qwen/qwen3-coder-480b-a35b-instruct": {
    iconColor: "text-indigo-400",
    badge: "Premium",
    badgeClass:
      "text-[9px] uppercase tracking-wider font-bold text-indigo-300 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 px-2 py-0.5 rounded-full border border-indigo-500/30",
  },
};

// Compile-time assertion that every primary model has a META entry.
// If you add a model to PRIMARY_MODELS without adding it to MODEL_META,
// this line will throw at runtime in dev — surfacing the gap early.
const PRIMARY_MODEL_IDS = PRIMARY_MODELS.map((m) => m.id);
if (process.env.NODE_ENV !== "production") {
  for (const id of PRIMARY_MODEL_IDS) {
    if (!MODEL_META[id]) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ModelSelector] Missing MODEL_META entry for primary model "${id}". ` +
          `Add it to components/ModelSelector.tsx or the icon/badge will be missing.`,
      );
    }
  }
}

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
            {iconForModel(selected.icon)}
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
          {iconForModel(model.icon)}
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
