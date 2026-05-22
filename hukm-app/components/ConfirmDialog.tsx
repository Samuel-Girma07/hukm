"use client";

import { useEffect, useRef } from "react";

import { Icon } from "./Icon";

import { useT } from "@/contexts/LanguageContext";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation dialog. Replaces `window.confirm()` for
 * destructive actions so labels are translatable and styling is
 * consistent with the rest of the app.
 *
 * - role=dialog + aria-modal so screen readers announce it.
 * - Esc dismisses; Enter triggers confirm; click outside cancels.
 * - Focus is moved to the cancel button on open (safer default).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement | null {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key === "Enter" && !busy) {
        event.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={description ? "confirm-desc" : undefined}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={cancelLabel ?? t("confirmDialog.cancel")}
        onClick={onCancel}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />
      <div className="relative w-full max-w-md rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] motion-safe:animate-popIn">
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            {destructive ? (
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent-red)/0.12)] text-[rgb(var(--accent-red))]">
                <Icon name="warning" size={20} filled />
              </span>
            ) : null}
            <div className="flex-1">
              <h2
                id="confirm-title"
                className="text-[18px] font-semibold tracking-tight text-on-surface"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id="confirm-desc"
                  className="mt-2 text-[14px] leading-relaxed text-on-surface-variant"
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={busy}
            >
              {cancelLabel ?? t("confirmDialog.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={
                destructive
                  ? "btn bg-[rgb(var(--accent-red))] text-white hover:bg-[rgb(var(--accent-red)/0.88)]"
                  : "btn-primary"
              }
            >
              {confirmLabel ?? t("confirmDialog.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
