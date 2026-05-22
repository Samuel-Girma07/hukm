"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ErrorState";
import { useT } from "@/contexts/LanguageContext";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps): React.ReactElement {
  const t = useT();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[hukm] root error boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          500
        </p>
        <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          {t("common.unexpectedTitle")}
        </h1>
      </div>
      <div className="mt-6">
        <ErrorState
          title={t("common.unexpectedTitle")}
          message={t("common.unexpectedBody")}
          onRetry={reset}
          retryLabel={t("common.retry")}
        />
      </div>
    </div>
  );
}
