import { Icon } from "./Icon";

interface StepCardProps {
  number: number;
  title: string;
  body: string;
  /** Renders with the cyan accent (used for Step 7 / Conclusion). */
  highlight?: boolean;
}

/**
 * Timeline-style step row. A numbered medallion sits in front of a
 * dark card. The parent draws the vertical rule.
 */
export function StepCard({
  number,
  title,
  body,
  highlight = false,
}: StepCardProps): React.ReactElement {
  return (
    <article className="relative z-10 flex gap-4">
      <div
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-full
          text-[13px] font-semibold leading-none tracking-tight
          shadow-[0_0_0_4px_rgb(var(--bg))]
          transition-colors duration-150 ease-out
          ${
            highlight
              ? "bg-[rgb(var(--accent-cyan))] text-[#0A0A0A]"
              : "bg-[rgb(var(--surface-elevated))] text-on-surface-variant ring-1 ring-[rgb(var(--border-subtle))]"
          }
        `}
      >
        {highlight ? <Icon name="flag" size={14} filled /> : number}
      </div>
      <div
        className={`
          flex-grow rounded-[14px] border bg-[rgb(var(--surface-elevated))]
          transition-[background-color,border-color] duration-150 ease-out
          ${
            highlight
              ? "border-[rgb(var(--accent-cyan)/0.4)]"
              : "border-[rgb(var(--border-subtle))]"
          }
        `}
      >
        <div className="p-5 sm:p-6">
          <h3 className="text-[16px] font-semibold tracking-tight text-on-surface">
            {title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface-variant">
            {body}
          </p>
        </div>
      </div>
    </article>
  );
}

interface SectionCardProps {
  title: string;
  body: string;
  tone?: "default" | "muted";
}

export function SectionCard({
  title,
  body,
  tone = "default",
}: SectionCardProps): React.ReactElement {
  return (
    <article
      className={`rounded-[14px] border border-[rgb(var(--border-subtle))] ${
        tone === "muted"
          ? "bg-[rgb(var(--surface))]"
          : "bg-[rgb(var(--surface-elevated))]"
      }`}
    >
      <div className="p-5 sm:p-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {title}
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-on-surface">
          {body}
        </p>
      </div>
    </article>
  );
}
