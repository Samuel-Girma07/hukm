"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "./ErrorState";

import { translate } from "@/lib/translations";
import type { Language } from "@/lib/types";

interface Props {
  children: ReactNode;
  language: Language;
}

interface State {
  error: Error | null;
}

interface SentryShape {
  showReportDialog?: (options?: { eventId?: string }) => void;
  captureException?: (err: unknown) => string;
}

function getSentry(): SentryShape | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as { Sentry?: SentryShape };
  return win.Sentry ?? null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const sentry = getSentry();
    if (sentry?.captureException) {
      try {
        sentry.captureException(error);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  reportIssue = (): void => {
    const sentry = getSentry();
    if (sentry?.showReportDialog) {
      try {
        sentry.showReportDialog();
        return;
      } catch {
        // fall through
      }
    }
    // No Sentry — open mailto: as a graceful fallback.
    window.location.href = `mailto:hello@hukm.local?subject=Bug%20report&body=${encodeURIComponent(
      this.state.error?.message ?? "",
    )}`;
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const t = (key: string) => translate(this.props.language, key);
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <ErrorState
          title={t("common.unexpectedTitle")}
          message={t("common.unexpectedBody")}
          onRetry={this.reset}
          retryLabel={t("common.retry")}
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={this.reportIssue}
            className="text-[12px] text-on-surface-variant underline hover:text-on-surface"
          >
            Report this issue
          </button>
        </div>
      </div>
    );
  }
}
