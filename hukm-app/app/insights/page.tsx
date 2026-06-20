"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/contexts/LanguageContext";
import { formatTime } from "@/lib/date";
import type { ArticleHeatmapRow } from "@/lib/types";

interface HeatmapResponse {
  success: boolean;
  generatedAt?: string;
  total?: number;
  rows?: ArticleHeatmapRow[];
  error?: string;
  code?: string;
}

export default function InsightsPage(): React.ReactElement {
  const t = useT();
  const [rows, setRows] = useState<ArticleHeatmapRow[]>([]);
  const [total, setTotal] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const response = await fetch("/api/insights/heatmap");
      const data = (await response.json()) as HeatmapResponse;
      if (!response.ok || !data.success) {
        setError(data.error ?? `HTTP ${response.status}`);
        setErrorCode(data.code ?? null);
        return;
      }
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setGeneratedAt(data.generatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="mb-8 flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            {t("nav.insights")}
          </p>
          <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
            {t("insights.title")}
          </h1>
          <p className="max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
            {t("insights.subtitle")}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant tabular-nums">
            {t("insights.countLabel", { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {generatedAt ? (
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant tabular-nums">
              {t("insights.lastUpdated", {
                time: formatTime(generatedAt),
              })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-icon"
            aria-label={t("insights.refresh")}
          >
            {loading ? <Spinner className="h-4 w-4" /> : <Icon name="refresh" size={16} />}
          </button>
        </div>
      </header>

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => void load()}
          title={
            errorCode === "MIGRATION_PENDING"
              ? t("common.setupRequired")
              : undefined
          }
        />
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="bar_chart"
            title={t("insights.emptyTitle")}
            body={t("insights.empty")}
            cta={{ href: "/", label: t("insights.emptyCta") }}
          />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]">
          <div className="hidden grid-cols-[60px_1fr_2fr_100px_80px] gap-4 border-b border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface))] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant md:grid">
            <span className="text-center">Rank</span>
            <span>{t("insights.columnArticle")}</span>
            <span>Relative usage</span>
            <span className="text-right">{t("insights.columnCount")}</span>
            <span className="text-right">% of total</span>
          </div>
          <ul className="divide-y divide-[rgb(var(--border-subtle))]">
            {rows.map((row, index) => (
              <li
                key={`${row.document_name}::${row.article_reference}`}
                className="grid grid-cols-1 gap-3 px-4 py-4 transition-colors duration-150 hover:bg-[rgb(var(--surface-overlay))] md:grid-cols-[60px_1fr_2fr_100px_80px] md:items-center md:px-6"
              >
                <span className="hidden text-center text-[18px] font-semibold tabular-nums text-on-surface-variant/80 md:inline">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight text-on-surface">
                    {row.article_reference}
                  </p>
                  <p className="mt-1 text-[11px] font-medium tracking-tight text-on-surface-variant">
                    {row.document_name}
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-overlay))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--accent-blue))] transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(2, row.percentage)}%` }}
                  />
                </div>
                <span className="text-[18px] font-semibold tabular-nums text-on-surface md:text-right">
                  {row.access_count}
                </span>
                <span className="text-[14px] tabular-nums text-on-surface-variant md:text-right">
                  {row.percentage.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
