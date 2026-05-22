interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline keyboard-shortcut hint, styled as a small keycap.
 */
export function Kbd({ children, className = "" }: KbdProps): React.ReactElement {
  return (
    <kbd
      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-overlay))] px-1.5 font-mono text-[10px] font-semibold leading-none text-on-surface-variant ${className}`}
    >
      {children}
    </kbd>
  );
}
