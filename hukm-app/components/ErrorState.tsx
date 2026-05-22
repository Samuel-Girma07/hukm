"use client";

import { Icon } from "./Icon";

import { useT } from "@/contexts/LanguageContext";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
}: ErrorStateProps): React.ReactElement {
  const t = useT();
  const heading = title ?? t("common.error");
  const retry = retryLabel ?? t("common.retry");
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-[12px] border border-[rgb(var(--accent-red)/0.4)] bg-[rgb(var(--accent-red)/0.10)] p-4 text-[rgb(var(--accent-red))]"
    >
      <div className="flex items-start gap-2.5">
        <Icon name="error" size={18} filled className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
            {heading}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-[rgb(var(--accent-red))/0.9]">
            {message}
          </p>
        </div>
      </div>
      {onRetry ? (
        <div>
          <button
            type="button"
            onClick={onRetry}
            className="btn-secondary"
          >
            {retry}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface InlineErrorProps {
  message: string;
}

export function InlineError({
  message,
}: InlineErrorProps): React.ReactElement {
  return (
    <p
      role="alert"
      className="text-[13px] text-[rgb(var(--accent-red))]"
    >
      {message}
    </p>
  );
}
