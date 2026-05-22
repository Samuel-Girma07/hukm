"use client";

import { useId, useState } from "react";

import { Icon } from "./Icon";

interface InfoHintProps {
  /** Plain-language explanation shown on hover/focus. */
  children: React.ReactNode;
  /** Optional aria-label override; defaults to "More information". */
  label?: string;
}

/**
 * Inline info-icon + tooltip. Shows on hover, focus, or tap; dismisses
 * on blur, Esc, or click elsewhere.
 */
export function InfoHint({
  children,
  label = "More information",
}: InfoHintProps): React.ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-on-surface focus:outline-none focus-visible:text-on-surface"
      >
        <Icon name="info" size={14} />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="
            absolute left-1/2 top-full z-20 mt-2 w-60 -translate-x-1/2
            rounded-[10px]
            border border-[rgb(var(--border-subtle))]
            bg-[rgb(var(--surface-elevated))]
            px-3 py-2
            text-[12px] leading-snug text-on-surface
            shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)]
            motion-safe:animate-popIn
          "
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
