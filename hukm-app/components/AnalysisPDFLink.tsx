"use client";

import { useEffect, useState } from "react";

import { AnalysisPDF } from "./AnalysisPDF";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import type { AnalysisResult, LawChunk } from "@/lib/types";

interface AnalysisPDFLinkProps {
  resultId: string;
  scenario: string;
  modelId: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
}

/**
 * Renders the PDF lazily and exposes a button that downloads the
 * generated blob. We deliberately avoid `@react-pdf/renderer`'s
 * `<PDFDownloadLink>` because it pre-renders synchronously on mount,
 * which is wasted work for users who never click "Export".
 */
export function AnalysisPDFLink({
  resultId,
  scenario,
  modelId,
  result,
  retrievedChunks,
}: AnalysisPDFLinkProps): React.ReactElement {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <AnalysisPDF
          scenario={scenario}
          result={result}
          retrievedChunks={retrievedChunks}
          modelId={modelId}
          generatedAt={new Date().toISOString().slice(0, 10)}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const filename = `HUKM-Analysis-${resultId.slice(0, 8)}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "export_pdf",
          metadata: { resultId },
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        className="btn-secondary"
      >
        {busy ? (
          <>
            <Spinner className="h-4 w-4" />
            <span>{t("results.exportingPdf")}</span>
          </>
        ) : (
          <>
            <Icon name="picture_as_pdf" size={14} />
            <span>{t("results.exportPdf")}</span>
          </>
        )}
      </button>
      {error ? (
        <p className="text-[12px] text-[rgb(var(--accent-red))]">{error}</p>
      ) : null}
    </div>
  );
}
