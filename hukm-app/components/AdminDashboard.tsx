"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorState } from "./ErrorState";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import { getModelTierLabel } from "@/lib/models";
import type {
  AdminStatsResponse,
  ArticleHeatmapRow,
  CacheStatsResponse,
} from "@/lib/types";

const ADMIN_KEY = "hukm-admin-auth";

/**
 * Dark dashboard recharts palette. Maps confidence levels to the same
 * accent colours used by `ConfidenceBadge`.
 */
const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "#30D158",       // green
  MEDIUM: "#5AC8FA",     // cyan
  LOW: "#FF9F0A",        // amber
  NEEDS_REVIEW: "#FF453A", // red
};

const CHART_GRID = "rgba(255,255,255,0.08)";
const CHART_AXIS = "#98989D";
const CHART_TOOLTIP_BG = "#1C1C1E";
const CHART_TOOLTIP_BORDER = "#38383A";
const CHART_TOOLTIP_TEXT = "#EBEBF5";
const CHART_PRIMARY = "#0A84FF";
const CHART_SECONDARY = "#5AC8FA";

interface HeatmapResponse {
  success: boolean;
  total?: number;
  rows?: ArticleHeatmapRow[];
}

export function AdminDashboard(): React.ReactElement {
  const t = useT();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [cache, setCache] = useState<CacheStatsResponse | null>(null);
  const [heatmap, setHeatmap] = useState<ArticleHeatmapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const [statsRes, cacheRes, heatRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/cache-stats"),
        fetch("/api/insights/heatmap"),
      ]);

      const [statsData, cacheData, heatData] = await Promise.all([
        statsRes.json() as Promise<
          AdminStatsResponse | { error?: string; code?: string }
        >,
        cacheRes.json() as Promise<CacheStatsResponse | { error?: string }>,
        heatRes.json() as Promise<HeatmapResponse & { code?: string }>,
      ]);

      if (!("success" in statsData) || !statsData.success) {
        const code = "code" in statsData ? statsData.code : undefined;
        const msg =
          ("error" in statsData && statsData.error) || `HTTP ${statsRes.status}`;
        if (code === "MIGRATION_PENDING") {
          setError(msg);
          setErrorCode(code);
          return;
        }
        throw new Error(msg);
      }
      if (!("success" in cacheData) || !cacheData.success) {
        throw new Error(
          ("error" in cacheData && cacheData.error) || `HTTP ${cacheRes.status}`,
        );
      }
      setStats(statsData);
      setCache(cacheData);
      setHeatmap(heatData.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const heatmapMax = useMemo(
    () => heatmap.reduce((m, r) => (r.access_count > m ? r.access_count : m), 0),
    [heatmap],
  );

  function signOut(): void {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_KEY);
    }
    router.replace("/admin/login");
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: CHART_TOOLTIP_BG,
    border: `1px solid ${CHART_TOOLTIP_BORDER}`,
    borderRadius: 10,
    fontSize: 12,
    color: CHART_TOOLTIP_TEXT,
  } as const;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Admin
          </p>
          <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
            {t("admin.dashboardTitle")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary"
            disabled={loading}
          >
            {loading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <>
                <Icon name="refresh" size={14} />
                <span>{t("admin.refresh")}</span>
              </>
            )}
          </button>
          <button type="button" onClick={signOut} className="btn-ghost">
            <span>{t("admin.signOut")}</span>
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

      {stats ? (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={t("admin.kpiAnalyses")} value={stats.totals.total_analyses} />
            <Kpi label={t("admin.kpiChats")} value={stats.totals.total_chats} />
            <Kpi
              label={t("admin.kpiTopModel")}
              value={
                stats.totals.top_model
                  ? getModelTierLabel(stats.totals.top_model)
                  : "—"
              }
            />
            <Kpi
              label={t("admin.kpiTopCategory")}
              value={stats.totals.top_crime_category ?? "—"}
            />
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title={t("admin.chartAnalysesPerDay")}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.perDay}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" />
                  <XAxis dataKey="date" stroke={CHART_AXIS} fontSize={11} />
                  <YAxis stroke={CHART_AXIS} fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: CHART_TOOLTIP_TEXT }}
                  />
                  <Line
                    type="monotone"
                    dataKey="analyses"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="chats"
                    stroke={CHART_SECONDARY}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("admin.chartConfidence")}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.byConfidence}
                    dataKey="count"
                    nameKey="level"
                    outerRadius={80}
                    stroke={CHART_TOOLTIP_BG}
                  >
                    {stats.byConfidence.map((slice) => (
                      <Cell
                        key={slice.level}
                        fill={CONFIDENCE_COLORS[slice.level] ?? "#636366"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("admin.chartModels")}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byModel}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="modelId"
                    stroke={CHART_AXIS}
                    fontSize={10}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis stroke={CHART_AXIS} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={CHART_PRIMARY} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("admin.chartLanguages")}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byLanguage}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" />
                  <XAxis dataKey="language" stroke={CHART_AXIS} fontSize={11} />
                  <YAxis stroke={CHART_AXIS} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={CHART_SECONDARY} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                {t("admin.sectionFeedback")}
              </h2>
              <div className="mt-3 flex items-center gap-4 text-[18px] font-semibold">
                <span className="text-[rgb(var(--accent-green))]">
                  ↑ {stats.feedback.up}
                </span>
                <span className="text-[rgb(var(--accent-red))]">
                  ↓ {stats.feedback.down}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {stats.feedback.recent.length === 0 ? (
                  <li className="text-[13px] text-on-surface-variant/70">—</li>
                ) : (
                  stats.feedback.recent.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-[10px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface))] p-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                        {entry.rating === 1 ? "↑" : "↓"}{" "}
                        <span className="opacity-50">·</span>{" "}
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface">
                        {entry.comment}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {cache ? (
              <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                  {t("admin.sectionCache")}
                </h2>
                <dl className="mt-3 grid grid-cols-2 gap-4">
                  <Stat
                    label={t("admin.cacheEmbeddings")}
                    value={cache.cachedEmbeddings.toLocaleString()}
                  />
                  <Stat
                    label={t("admin.cacheAnalyses")}
                    value={cache.cachedAnalyses.toLocaleString()}
                  />
                  <Stat
                    label={t("admin.cacheSavedRequests")}
                    value={cache.estimatedRequestsSaved.toLocaleString()}
                  />
                  <Stat
                    label={t("admin.cacheSavedCost")}
                    value={`$${cache.estimatedCostSavedUsd.toFixed(4)}`}
                  />
                </dl>
              </div>
            ) : null}
          </section>

          <section className="mt-6 rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {t("admin.sectionHeatmap")}
            </h2>
            <ul className="mt-4 space-y-2">
              {heatmap.map((row) => {
                const width =
                  heatmapMax > 0 ? (row.access_count / heatmapMax) * 100 : 0;
                return (
                  <li
                    key={`${row.document_name}::${row.article_reference}`}
                    className="rounded-[10px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface))] p-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold tracking-tight text-on-surface">
                        {row.article_reference}
                      </p>
                      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums text-on-surface-variant">
                        {row.access_count}
                      </p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgb(var(--surface-overlay))]">
                      <div
                        className="h-1 rounded-full bg-[rgb(var(--accent-blue))] transition-all duration-300 ease-out"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

interface KpiProps {
  label: string;
  value: string | number;
}

function Kpi({ label, value }: KpiProps): React.ReactElement {
  return (
    <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-2 text-[20px] font-semibold tracking-tight text-on-surface tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function Stat({ label, value }: KpiProps): React.ReactElement {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-1 text-[18px] font-semibold tracking-tight text-on-surface tabular-nums">
        {value}
      </dd>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps): React.ReactElement {
  return (
    <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
