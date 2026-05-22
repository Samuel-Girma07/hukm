import { CTAButton } from "./CTAButton";
import { Icon } from "./Icon";

interface EmptyStateProps {
  /** Title shown above the body. */
  title: string;
  /** 1-2 sentence body explaining what would appear here and why. */
  body: string;
  /** Material Symbol glyph (mapped to Phosphor) used inside the medallion. */
  icon: string;
  /** Optional CTA. Renders as a primary button. */
  cta?: {
    href: string;
    label: string;
  };
  /** Optional secondary slot (e.g. extra link, alternate action). */
  secondary?: React.ReactNode;
}

/**
 * Designed empty state for History, Insights, Offline, and other "0
 * items" panes. Dark Perplexity-style elevated card with a muted icon
 * medallion, sans heading, and a clear CTA.
 */
export function EmptyState({
  title,
  body,
  icon,
  cta,
  secondary,
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-md rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] motion-safe:animate-riseIn">
      <div className="flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-8 sm:py-12">
        <span
          aria-hidden
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--surface-overlay))] text-on-surface-variant ring-1 ring-[rgb(var(--border-subtle))]"
        >
          <Icon name={icon} size={22} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-semibold tracking-tight text-on-surface">
            {title}
          </h2>
          <p className="text-[14px] leading-relaxed text-on-surface-variant">
            {body}
          </p>
        </div>
        {cta ? (
          <CTAButton href={cta.href} variant="primary" trailingIcon="arrow_forward" className="mt-1">
            {cta.label}
          </CTAButton>
        ) : null}
        {secondary ? (
          <div className="text-[13px] text-on-surface-variant">{secondary}</div>
        ) : null}
      </div>
    </div>
  );
}
