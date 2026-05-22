"use client";

import { Icon } from "./Icon";

import { useT } from "@/contexts/LanguageContext";

interface CacheHitBadgeProps {
  className?: string;
}

export function CacheHitBadge({
  className = "",
}: CacheHitBadgeProps): React.ReactElement {
  const t = useT();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--accent-cyan)/0.4)] bg-[rgb(var(--accent-cyan)/0.10)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(var(--accent-cyan))] ${className}`}
    >
      <Icon name="bolt" size={12} filled />
      {t("results.cacheBadge")}
    </span>
  );
}
