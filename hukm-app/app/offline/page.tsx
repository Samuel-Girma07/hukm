"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/contexts/LanguageContext";
import { formatDateTime } from "@/lib/date";
import { getAllAnalyses, type StoredAnalysis } from "@/lib/idb";

export default function OfflinePage(): React.ReactElement {
  const t = useT();
  const [items, setItems] = useState<StoredAnalysis[] | null>(null);

  useEffect(() => {
    void getAllAnalyses().then((entries) => setItems(entries));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          Offline
        </p>
        <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          {t("offline.title")}
        </h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
          {t("offline.subtitle")}
        </p>
      </header>

      {items === null ? (
        <div className="mt-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          <Spinner className="h-4 w-4" />
          {t("common.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="cloud_off"
            title={t("offline.emptyTitle")}
            body={t("offline.empty")}
          />
        </div>
      ) : (
        <ul className="mt-7 flex flex-col gap-2">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="
                rounded-[14px] border border-[rgb(var(--border-subtle))]
                bg-[rgb(var(--surface-elevated))]
                transition-[background-color,border-color,transform] duration-150 ease-out
                hover:bg-[rgb(var(--surface-overlay))] hover:border-[rgb(var(--border-visible))]
                motion-safe:hover:-translate-y-px
              "
            >
              <div className="p-5">
                <Link
                  href={`/results/${entry.id}`}
                  className="flex items-center gap-3 text-[16px] font-semibold tracking-tight text-on-surface transition-colors duration-150 hover:text-[rgb(var(--accent-cyan))]"
                >
                  <Icon name="description" size={18} />
                  <span className="line-clamp-2">
                    {entry.scenario.slice(0, 140)}
                    {entry.scenario.length > 140 ? "…" : ""}
                  </span>
                </Link>
                <p className="mt-3 flex items-center gap-2 text-[11px] font-medium tabular-nums text-on-surface-variant">
                  <Icon name="schedule" size={12} />
                  {formatDateTime(entry.created_at)}
                  <span className="opacity-50">·</span>
                  <span>{entry.modelId}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
