"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import { formatDateTime } from "@/lib/date";
import { getModelTierLabel } from "@/lib/models";
import type { RecentConversationRow } from "@/lib/types";

interface HistoryListProps {
  initialRows: RecentConversationRow[];
}

type DateFilter = "today" | "week" | "all";

export function HistoryList({
  initialRows,
}: HistoryListProps): React.ReactElement {
  const t = useT();
  const [rows, setRows] = useState<RecentConversationRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DateFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<RecentConversationRow | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      filter === "today"
        ? 24 * 3600_000
        : filter === "week"
          ? 7 * 24 * 3600_000
          : null;
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (cutoffMs !== null) {
        const created = new Date(row.created_at).getTime();
        if (now - created > cutoffMs) return false;
      }
      if (term.length > 0) {
        const haystack = (
          row.scenario_description ??
          row.first_user_message ??
          ""
        ).toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, filter]);

  async function performDelete(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    const previous = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setRows(previous);
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? `HTTP ${response.status}`);
      }
    } catch (err) {
      setRows(previous);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  const countLabel =
    filtered.length === 1
      ? t("history.countLabelOne")
      : t("history.countLabelOther");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          {t("nav.history")}
        </p>
        <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          {t("history.title")}
        </h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
          {t("history.subtitle")}
        </p>
      </header>

      {/* Search + filters */}
      <div
        className="
          flex flex-wrap items-center gap-3 rounded-full
          border border-[rgb(var(--border-subtle))]
          bg-[rgb(var(--surface-elevated))]
          px-3 py-1.5
        "
      >
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            className="
              w-full rounded-full border-none bg-transparent
              py-2 pl-9 pr-3 text-[14px] text-on-surface
              placeholder:text-[rgb(var(--text-muted))]
              focus:outline-none focus:ring-0
            "
            placeholder={t("history.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <FilterButton
            active={filter === "today"}
            onClick={() => setFilter("today")}
          >
            {t("history.filterToday")}
          </FilterButton>
          <FilterButton
            active={filter === "week"}
            onClick={() => setFilter("week")}
          >
            {t("history.filterWeek")}
          </FilterButton>
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            {t("history.filterAll")}
          </FilterButton>
        </div>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant tabular-nums">
        {t("history.countLabel", { count: filtered.length, countLabel })}
      </p>

      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}

      {filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            icon="auto_stories"
            title={t("history.emptyTitle")}
            body={t("history.empty")}
            cta={{ href: "/", label: t("history.emptyCta") }}
          />
        ) : (
          <EmptyState
            icon="search_off"
            title={t("history.emptyFilteredTitle")}
            body={t("history.emptyFiltered")}
            secondary={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="text-[12px] font-medium text-[rgb(var(--accent-cyan))] hover:underline"
              >
                {t("history.clearFilters")}
              </button>
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="
                rounded-[14px] border border-[rgb(var(--border-subtle))]
                bg-[rgb(var(--surface-elevated))]
                transition-[background-color,border-color,transform] duration-150 ease-out
                hover:bg-[rgb(var(--surface-overlay))] hover:border-[rgb(var(--border-visible))]
                motion-safe:hover:-translate-y-px
              "
            >
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/chat/${row.id}`}
                    className="text-[16px] font-semibold tracking-tight text-on-surface transition-colors duration-150 hover:text-[rgb(var(--accent-cyan))]"
                  >
                    {row.scenario_description?.trim() ||
                      row.first_user_message?.trim() ||
                      t("chat.untitled")}
                  </Link>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-tight text-on-surface-variant tabular-nums">
                    <Icon name="schedule" size={12} />
                    {formatDateTime(row.updated_at)}
                    <span className="opacity-50">·</span>
                    <span>{getModelTierLabel(row.model_id)}</span>
                    <span className="opacity-50">·</span>
                    {row.message_count} msg
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.confidence_level ? (
                    <ConfidenceBadge level={row.confidence_level} />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(row)}
                    disabled={busyId === row.id}
                    className="
                      inline-flex h-9 w-9 items-center justify-center rounded-full
                      text-on-surface-variant transition-colors duration-150
                      hover:bg-[rgb(var(--accent-red)/0.12)] hover:text-[rgb(var(--accent-red))]
                    "
                    aria-label={t("common.delete")}
                  >
                    {busyId === row.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Icon name="delete" size={16} />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("history.deleteConfirmTitle")}
        description={
          pendingDelete?.scenario_description?.trim() ??
          pendingDelete?.first_user_message?.trim() ??
          t("chat.untitled")
        }
        confirmLabel={t("common.delete")}
        destructive
        busy={busyId === pendingDelete?.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void performDelete(pendingDelete.id);
        }}
      />
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({
  active,
  onClick,
  children,
}: FilterButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-[rgb(var(--accent-blue))] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors duration-150"
          : "rounded-full bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant transition-colors duration-150 hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface"
      }
    >
      {children}
    </button>
  );
}
