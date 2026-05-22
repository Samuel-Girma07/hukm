"use client";

import { Icon } from "./Icon";

import { useT } from "@/contexts/LanguageContext";
import type { ConfidenceLevel } from "@/lib/types";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  className?: string;
}

interface Style {
  classes: string;
  icon: string;
  filled: boolean;
}

/**
 * Semantic colour mapping in the new dark accent palette:
 *   HIGH         → green   (success)
 *   MEDIUM       → cyan    (informational)
 *   LOW          → amber   (warning)
 *   NEEDS_REVIEW → red     (error / abstain)
 */
const STYLES: Record<ConfidenceLevel, Style> = {
  HIGH: {
    classes:
      "border-[rgb(var(--accent-green)/0.45)] bg-[rgb(var(--accent-green)/0.12)] text-[rgb(var(--accent-green))]",
    icon: "verified",
    filled: true,
  },
  MEDIUM: {
    classes:
      "border-[rgb(var(--accent-cyan)/0.45)] bg-[rgb(var(--accent-cyan)/0.12)] text-[rgb(var(--accent-cyan))]",
    icon: "balance",
    filled: false,
  },
  LOW: {
    classes:
      "border-[rgb(var(--accent-amber)/0.45)] bg-[rgb(var(--accent-amber)/0.12)] text-[rgb(var(--accent-amber))]",
    icon: "warning",
    filled: true,
  },
  NEEDS_REVIEW: {
    classes:
      "border-[rgb(var(--accent-red)/0.45)] bg-[rgb(var(--accent-red)/0.12)] text-[rgb(var(--accent-red))]",
    icon: "report",
    filled: true,
  },
};

export function ConfidenceBadge({
  level,
  className = "",
}: ConfidenceBadgeProps): React.ReactElement {
  const t = useT();
  const style = STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${style.classes} ${className}`}
    >
      <Icon name={style.icon} size={14} filled={style.filled} />
      {t(`confidence.${level}`)}
    </span>
  );
}
