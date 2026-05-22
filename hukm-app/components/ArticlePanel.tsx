"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "./ErrorState";
import { Icon } from "./Icon";
import { LawChunkCard } from "./LawChunkCard";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import type { LawChunk } from "@/lib/types";

interface ArticlePanelProps {
  chunk: LawChunk | null;
  onClose: () => void;
}

interface RelatedResponse {
  success: boolean;
  article?: {
    id: number;
    document_name: string;
    article_reference: string;
    content: string;
  };
  citationCount?: number;
  related?: LawChunk[];
  error?: string;
}

export function ArticlePanel({
  chunk,
  onClose,
}: ArticlePanelProps): React.ReactElement | null {
  const t = useT();
  const [related, setRelated] = useState<LawChunk[] | null>(null);
  const [citationCount, setCitationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chunk) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [chunk]);

  useEffect(() => {
    if (!chunk) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chunk, onClose]);

  useEffect(() => {
    if (!chunk) {
      setRelated(null);
      setCitationCount(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/articles/${encodeURIComponent(chunk.article_reference)}/related`,
        );
        const data = (await response.json().catch(() => null)) as
          | RelatedResponse
          | null;
        if (cancelled) return;
        if (!response.ok || !data || !data.success) {
          setError(data?.error ?? `HTTP ${response.status}`);
          setRelated([]);
          return;
        }
        setRelated(data.related ?? []);
        setCitationCount(data.citationCount ?? 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setRelated([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "article_viewed",
        metadata: { article_reference: chunk.article_reference },
      }),
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [chunk]);

  if (!chunk) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-panel-title"
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute inset-0 animate-fadeIn bg-black/65 backdrop-blur-sm"
      />
      <aside
        className="
          absolute inset-y-0 right-0 flex w-full
          animate-slideInRight flex-col overflow-y-auto
          border-l border-[rgb(var(--border-subtle))]
          bg-[rgb(var(--surface))]
          shadow-[0_0_80px_-12px_rgba(0,0,0,0.65)]
          sm:w-[480px]
        "
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface)/0.95)] px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {chunk.document_name}
            </p>
            <h2
              id="article-panel-title"
              className="mt-1 text-[18px] font-semibold tracking-tight text-on-surface"
            >
              {chunk.article_reference}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              <Icon name="psychology" size={12} />
              <span className="tabular-nums">
                {(chunk.similarity * 100).toFixed(1)}%
              </span>
              <span>·</span>
              <span>{citationCount === null ? "…" : `${citationCount} citations`}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            aria-label={t("common.close")}
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <section className="px-5 py-4">
          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-on-surface">
            {chunk.content}
          </p>
        </section>

        <section className="border-t border-[rgb(var(--border-subtle))] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Related articles
          </p>
          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-[14px] text-on-surface-variant">
              <Spinner className="h-4 w-4" />
              {t("common.loading")}
            </div>
          ) : error ? (
            <div className="mt-3">
              <ErrorState message={error} />
            </div>
          ) : related && related.length === 0 ? (
            <p className="mt-3 text-[14px] text-on-surface-variant">
              No related articles found.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {(related ?? []).map((c, i) => (
                <LawChunkCard key={c.id} chunk={c} index={i} variant="row" />
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
