"use client";

import React, { useEffect, useState } from "react";

import { AnalysisPDF } from "./AnalysisPDF";

import type { AnalysisResult, LawChunk } from "@/lib/types";

interface DownloadButtonProps {
  resultId: string;
  scenario: string;
  modelId: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
}

/**
 * Morphing download button — dark theme consistent.
 *
 * Default: pill-shaped dark button with "Download" text.
 * Hover: morphs into a circle, text hides, download icon appears,
 * spinning ring in accent-cyan.
 */
export function DownloadButton({
  resultId,
  scenario,
  modelId,
  result,
  retrievedChunks,
}: DownloadButtonProps): React.ReactElement {
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
    <>

      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="hukm-download-btn"
        >
          <span className="hukm-dl-text">{busy ? "…" : "Download"}</span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="hukm-dl-icon"
          >
            <path
              d="M6 21H18M12 3V17M12 17L17 12M12 17L7 12"
              stroke="#f1f1f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {error ? (
          <p className="text-[12px] text-[rgb(var(--accent-red))]">{error}</p>
        ) : null}
      </div>
    </>
  );
}
