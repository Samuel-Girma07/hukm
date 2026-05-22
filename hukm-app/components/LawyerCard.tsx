"use client";

import { Icon } from "./Icon";

import { useT } from "@/contexts/LanguageContext";
import type { LegalResource } from "@/lib/types";

interface LawyerCardProps {
  resource: LegalResource;
}

const TYPE_ICON: Record<LegalResource["type"], string> = {
  law_firm: "gavel",
  legal_aid: "school",
  bar_association: "account_balance",
  court: "balance",
};

export function LawyerCard({
  resource,
}: LawyerCardProps): React.ReactElement {
  const t = useT();

  const typeLabel =
    resource.type === "law_firm"
      ? t("resources.typeLawFirm")
      : resource.type === "legal_aid"
        ? t("resources.typeLegalAid")
        : resource.type === "bar_association"
          ? t("resources.typeBarAssociation")
          : t("resources.typeCourt");

  return (
    <article className="group rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-[rgb(var(--surface-overlay))] hover:border-[rgb(var(--border-visible))] motion-safe:hover:-translate-y-px">
      <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold tracking-tight text-on-surface transition-colors duration-150 group-hover:text-[rgb(var(--accent-cyan))]">
              {resource.name}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip">{typeLabel}</span>
              {resource.isFreeService ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--accent-green)/0.4)] bg-[rgb(var(--accent-green)/0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--accent-green))]">
                  <Icon name="check_circle" size={10} filled />
                  {t("resources.free")}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {resource.city}
            </p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[rgb(var(--surface-overlay))] text-on-surface-variant">
            <Icon name={TYPE_ICON[resource.type]} size={18} />
          </span>
        </header>

        <p className="line-clamp-3 text-[14px] leading-relaxed text-on-surface-variant">
          {resource.description}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <Icon name="translate" size={12} />
            <span>
              {resource.languages
                .map((l) => (l === "en" ? "EN" : "አማ"))
                .join(" · ")}
            </span>
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[rgb(var(--border-subtle))] pt-4">
          <div className="flex items-center gap-1">
            {resource.phone ? (
              <a
                href={`tel:${resource.phone}`}
                title={t("resources.contactPhone")}
                aria-label={t("resources.contactPhone")}
                className="btn-icon"
              >
                <Icon name="call" size={16} />
              </a>
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center opacity-30 text-on-surface-variant">
                <Icon name="call" size={16} />
              </span>
            )}
            {resource.email ? (
              <a
                href={`mailto:${resource.email}`}
                title={t("resources.contactEmail")}
                aria-label={t("resources.contactEmail")}
                className="btn-icon"
              >
                <Icon name="mail" size={16} />
              </a>
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center opacity-30 text-on-surface-variant">
                <Icon name="mail" size={16} />
              </span>
            )}
          </div>
          {resource.website ? (
            <a
              href={resource.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[rgb(var(--accent-cyan))] hover:underline"
            >
              {t("resources.contactWebsite")}
              <Icon name="arrow_forward" size={12} />
            </a>
          ) : (
            <span className="text-[11px] text-on-surface-variant/70">
              {t("resources.contactNotListed")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
