interface HukmMarkProps {
  /** Pixel size for the surrounding chip (square). Default 32. */
  size?: number;
  className?: string;
}

/**
 * HUKM brand mark.
 *
 * Compact chip combining a stylised "H" with a balance-of-justice
 * crossbar above it. Reads as the single character "H" but the inner
 * geometry is shaped so the top horizontal bar and small support
 * indents recall a balance scale — quietly nodding to the legal
 * domain without becoming a decorative gavel/scales icon.
 */
export function HukmMark({
  size = 32,
  className = "",
}: HukmMarkProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[8px] bg-[rgb(var(--surface-elevated))] ring-1 ring-[rgb(var(--border-subtle))] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.625)}
        height={Math.round(size * 0.625)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-on-surface"
      >
        {/* Balance-scale crossbar */}
        <path d="M3.5 5h17" />
        <circle cx="12" cy="5" r="1.05" fill="currentColor" stroke="none" />
        {/* Two pans (small ticks at the ends of the bar) */}
        <path d="M5 5v1.6" />
        <path d="M19 5v1.6" />
        {/* H letterform */}
        <path d="M6 8.5v11" />
        <path d="M18 8.5v11" />
        <path d="M6 14h12" />
      </svg>
    </span>
  );
}
