"use client";

import { useEffect, useState } from "react";

import { Icon } from "./Icon";
import { Kbd } from "./Kbd";

import { useT } from "@/contexts/LanguageContext";

/**
 * Global "?"-press → opens a shortcut cheatsheet. Mounts at the layout
 * level so it works on every page. Closes on Esc, click outside, or the
 * close button.
 */
export function ShortcutsHelp(): React.ReactElement | null {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target?.isContentEditable ?? false);
      if (!open && event.key === "?" && !inField) {
        event.preventDefault();
        setOpen(true);
      } else if (open && event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const shortcuts: Array<{ keys: React.ReactNode; label: string }> = [
    { keys: <Kbd>/</Kbd>, label: t("shortcuts.focusScenario") },
    {
      keys: (
        <span className="inline-flex gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>Enter</Kbd>
        </span>
      ),
      label: t("shortcuts.submit"),
    },
    { keys: <Kbd>Esc</Kbd>, label: t("shortcuts.cancel") },
    { keys: <Kbd>?</Kbd>, label: t("shortcuts.toggleHelp") },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />
      <div className="relative w-full max-w-md rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] motion-safe:animate-popIn">
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="shortcuts-title"
              className="text-[18px] font-semibold tracking-tight text-on-surface"
            >
              {t("shortcuts.title")}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="btn-icon"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <ul className="mt-6 flex flex-col gap-4">
            {shortcuts.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 text-[14px] text-on-surface"
              >
                <span>{s.label}</span>
                {s.keys}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
