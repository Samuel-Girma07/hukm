"use client";

import { useState } from "react";

import { Icon } from "./Icon";
import { LawChunkCard } from "./LawChunkCard";

import { useT } from "@/contexts/LanguageContext";
import type { LawChunk } from "@/lib/types";

interface SourcesPanelProps {
  chunks: LawChunk[];
  defaultOpen?: boolean;
  title?: string;
  onOpenChunk?: (chunk: LawChunk) => void;
  /** When "flat", renders the list inline (no surrounding details). */
  layout?: "details" | "flat";
}

export function SourcesPanel({
  chunks,
  defaultOpen = false,
  title,
  onOpenChunk,
  layout = "details",
}: SourcesPanelProps): React.ReactElement {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen || layout === "flat");
  const heading = title ?? t("results.sources");

  if (chunks.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface))] px-4 py-3 text-[13px] text-on-surface-variant">
        {t("results.sourcesEmpty")}
      </div>
    );
  }

  const countLabel =
    chunks.length === 1
      ? t("results.sourcesCountOne")
      : t("results.sourcesCountOther");

  if (layout === "flat") {
    return (
      <div className="space-y-2">
        {chunks.map((chunk, idx) => (
          <LawChunkCard
            key={chunk.id}
            chunk={chunk}
            index={idx}
            onOpen={onOpenChunk}
            variant="row"
          />
        ))}
      </div>
    );
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3 text-[15px] font-semibold text-on-surface marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Icon
            name="chevron_right"
            size={14}
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          />
          {heading}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {chunks.length} {countLabel}
        </span>
      </summary>
      <div className="space-y-2 border-t border-[rgb(var(--border-subtle))] px-3 py-3 sm:px-4 sm:py-4">
        {chunks.map((chunk, idx) => (
          <LawChunkCard
            key={chunk.id}
            chunk={chunk}
            index={idx}
            onOpen={onOpenChunk}
            variant="row"
          />
        ))}
      </div>
    </details>
  );
}
