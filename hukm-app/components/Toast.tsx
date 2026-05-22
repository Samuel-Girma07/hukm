"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  /** Message to display. When the message changes, the toast resets. */
  message: string | null;
  /** Duration in milliseconds. Defaults to 3000. */
  durationMs?: number;
  onDismiss: () => void;
}

export function Toast({
  message,
  durationMs = 3000,
  onDismiss,
}: ToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timeout = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 200);
    }, durationMs);
    return () => window.clearTimeout(timeout);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
      }`}
    >
      <div
        className="
          pointer-events-auto
          rounded-full
          border border-[rgb(var(--border-subtle))]
          bg-[rgb(var(--surface-elevated)/0.92)] backdrop-blur-xl
          px-4 py-2 text-[13px] font-medium text-on-surface
          shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)]
        "
      >
        {message}
      </div>
    </div>
  );
}
