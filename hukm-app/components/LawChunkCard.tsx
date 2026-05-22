"use client";

import { Icon } from "./Icon";

import type { LawChunk } from "@/lib/types";

interface LawChunkCardProps {
  chunk: LawChunk;
  index: number;
  onOpen?: (chunk: LawChunk) => void;
  variant?: "row" | "card";
}

/**
 * Similarity tone in the new dark accent palette:
 *   ≥ 0.70  → blue/cyan  (strong)
 *   0.50-0.69 → green   (moderate)
 *   0.30-0.49 → amber   (weak)
 *   < 0.30  → red       (very weak)
 */
function similarityTone(similarity: number): string {
  if (similarity >= 0.7)
    return "border-[rgb(var(--accent-cyan)/0.4)] bg-[rgb(var(--accent-cyan)/0.10)] text-[rgb(var(--accent-cyan))]";
  if (similarity >= 0.5)
    return "border-[rgb(var(--accent-green)/0.4)] bg-[rgb(var(--accent-green)/0.10)] text-[rgb(var(--accent-green))]";
  if (similarity >= 0.3)
    return "border-[rgb(var(--accent-amber)/0.4)] bg-[rgb(var(--accent-amber)/0.10)] text-[rgb(var(--accent-amber))]";
  return "border-[rgb(var(--accent-red)/0.4)] bg-[rgb(var(--accent-red)/0.10)] text-[rgb(var(--accent-red))]";
}

export function LawChunkCard({
  chunk,
  index,
  onOpen,
  variant = "row",
}: LawChunkCardProps): React.ReactElement {
  const pct = (chunk.similarity * 100).toFixed(1);
  const tone = similarityTone(chunk.similarity);

  if (variant === "row") {
    return <RowBody chunk={chunk} pct={pct} tone={tone} onOpen={onOpen} />;
  }

  const card = (
    <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] transition-colors hover:bg-[rgb(var(--surface-overlay))]">
      <header className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border-subtle))] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Source {index + 1}
          </p>
          <h3 className="mt-0.5 truncate text-[15px] font-semibold text-on-surface">
            {chunk.article_reference}
          </h3>
          <p className="mt-1 truncate text-[13px] text-on-surface-variant">
            {chunk.document_name}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
        >
          {pct}%
        </span>
      </header>
      <p className="whitespace-pre-wrap break-words px-4 py-3 text-[13px] text-on-surface-variant">
        {chunk.content}
      </p>
    </div>
  );

  if (!onOpen) return card;
  return (
    <button
      type="button"
      onClick={() => onOpen(chunk)}
      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]"
      aria-label={`Open article ${chunk.article_reference}`}
    >
      {card}
    </button>
  );
}

interface RowBodyProps {
  chunk: LawChunk;
  pct: string;
  tone: string;
  onOpen?: (chunk: LawChunk) => void;
}

function RowBody({
  chunk,
  pct,
  tone,
  onOpen,
}: RowBodyProps): React.ReactElement {
  const body = (
    <div className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-3 transition-colors duration-150 hover:bg-[rgb(var(--surface-overlay))]">
      <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgb(var(--surface-overlay))] text-on-surface-variant sm:flex">
        <Icon name="gavel" size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[14px] font-semibold leading-tight text-on-surface">
            {chunk.article_reference}
          </h4>
          <span className="chip">{chunk.document_name}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] text-on-surface-variant">
          {chunk.content}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
        >
          {pct}%
        </span>
        {onOpen ? (
          <Icon
            name="chevron_right"
            size={16}
            className="hidden text-on-surface-variant md:inline-block"
          />
        ) : null}
      </div>
    </div>
  );

  if (!onOpen) return body;
  return (
    <button
      type="button"
      onClick={() => onOpen(chunk)}
      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]"
      aria-label={`Open article ${chunk.article_reference}`}
    >
      {body}
    </button>
  );
}
