import type { ReactNode } from "react";

type BezelSize = "sm" | "md";
type BezelTone = "default" | "muted" | "glass";

interface BezelProps {
  /** Inner content. */
  children: ReactNode;
  /** Visual size. Both sizes render a flat dark Perplexity-style card. */
  size?: BezelSize;
  /**
   * Surface tone.
   *  - `default` → standard `#1C1C1E` card.
   *  - `muted`   → page-canvas tone for subdued contexts.
   *  - `glass`   → translucent + backdrop-blur (use only on fixed/sticky parents).
   */
  tone?: BezelTone;
  /** Adds a soft ambient drop-shadow. */
  elevated?: boolean;
  /** Extra utility classes on the inner content wrapper. */
  className?: string;
  /** Extra utility classes on the outer container. */
  shellClassName?: string;
}

/**
 * Compatibility shim for the old "double-bezel" component.
 *
 * Renders a single flat dark Perplexity-style card. The inner/outer
 * split is kept so callers compile without churn, but visually it is
 * one surface.
 */
export function Bezel({
  children,
  size = "md",
  tone = "default",
  elevated = false,
  className = "",
  shellClassName = "",
}: BezelProps): React.ReactElement {
  const radius = size === "sm" ? "rounded-[12px]" : "rounded-[14px]";

  const toneClasses =
    tone === "muted"
      ? "bg-[rgb(var(--surface))]"
      : tone === "glass"
        ? "bg-[rgb(var(--surface-elevated)/0.85)] backdrop-blur-xl"
        : "bg-[rgb(var(--surface-elevated))]";

  const elevation = elevated ? "shadow-[0_8px_32px_rgba(0,0,0,0.45)]" : "";

  return (
    <div
      className={`${radius} border border-[rgb(var(--border-subtle))] ${toneClasses} ${elevation} ${shellClassName}`}
    >
      <div className={className}>{children}</div>
    </div>
  );
}
