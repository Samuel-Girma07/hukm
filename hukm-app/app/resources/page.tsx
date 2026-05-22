"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/Icon";
import { LawyerCard } from "@/components/LawyerCard";
import { useT } from "@/contexts/LanguageContext";
import { LEGAL_DIRECTORY } from "@/lib/legalDirectory";

type Filter = "all" | "free" | "en" | "am" | "criminal" | "legal_aid" | "bar";

export default function ResourcesPage(): React.ReactElement {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    switch (filter) {
      case "free":
        return LEGAL_DIRECTORY.filter((r) => r.isFreeService);
      case "en":
        return LEGAL_DIRECTORY.filter((r) => r.languages.includes("en"));
      case "am":
        return LEGAL_DIRECTORY.filter((r) => r.languages.includes("am"));
      case "criminal":
        return LEGAL_DIRECTORY.filter((r) =>
          r.specializations.some((s) => s.includes("criminal")),
        );
      case "legal_aid":
        return LEGAL_DIRECTORY.filter((r) => r.type === "legal_aid");
      case "bar":
        return LEGAL_DIRECTORY.filter((r) => r.type === "bar_association");
      default:
        return LEGAL_DIRECTORY;
    }
  }, [filter]);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          {t("nav.resources")}
        </p>
        <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          {t("resources.title")}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
          {t("resources.subtitle")}
        </p>
      </header>

      {/* Filter chip strip */}
      <div className="mt-7 scrollbar-hidden flex items-center gap-1 overflow-x-auto rounded-full border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("resources.filterAll")}
        </FilterChip>
        <FilterChip active={filter === "free"} onClick={() => setFilter("free")}>
          {t("resources.filterFree")}
        </FilterChip>
        <FilterChip active={filter === "en"} onClick={() => setFilter("en")}>
          {t("resources.filterEnglish")}
        </FilterChip>
        <FilterChip active={filter === "am"} onClick={() => setFilter("am")}>
          {t("resources.filterAmharic")}
        </FilterChip>
        <FilterChip
          active={filter === "criminal"}
          onClick={() => setFilter("criminal")}
        >
          {t("resources.filterCriminal")}
        </FilterChip>
        <FilterChip
          active={filter === "legal_aid"}
          onClick={() => setFilter("legal_aid")}
        >
          {t("resources.typeLegalAid")}
        </FilterChip>
        <FilterChip active={filter === "bar"} onClick={() => setFilter("bar")}>
          {t("resources.typeBarAssociation")}
        </FilterChip>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.map((resource) => (
          <LawyerCard key={resource.name} resource={resource} />
        ))}
      </div>

      {/* Bottom callout */}
      <section className="relative mt-10 overflow-hidden rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgb(var(--accent-blue)/0.10)] to-transparent"
        />
        <div className="relative flex flex-col items-center justify-between gap-5 p-6 sm:p-8 md:flex-row">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-[rgb(var(--surface-overlay))] text-[rgb(var(--accent-cyan))]">
              <Icon name="support_agent" size={22} />
            </span>
            <div>
              <h3 className="text-[20px] font-semibold tracking-tight text-on-surface">
                {t("resources.calloutTitle")}
              </h3>
              <p className="mt-1 max-w-prose text-[14px] leading-relaxed text-on-surface-variant">
                {t("resources.calloutBody")}
              </p>
            </div>
          </div>
          <Link href="/resources#bar" className="btn-primary">
            <span>{t("resources.calloutAction")}</span>
            <Icon name="arrow_forward" size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({
  active,
  onClick,
  children,
}: FilterChipProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "whitespace-nowrap rounded-full bg-[rgb(var(--accent-blue))] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors duration-150"
          : "whitespace-nowrap rounded-full bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant transition-colors duration-150 hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface"
      }
    >
      {children}
    </button>
  );
}
