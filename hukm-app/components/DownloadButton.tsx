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
      <style>{`
        @keyframes hukm-download-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .hukm-download-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 125px;
          height: 45px;
          border-radius: 20px;
          border: 1px solid rgb(var(--border-subtle));
          padding: 5px 10px;
          color: #fff;
          font-family: inherit;
          font-weight: 500;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          background: rgb(var(--surface-overlay));
          box-shadow: 0 0 1em 0.5em rgba(0, 0, 0, 0.15);
          transition: width 0.5s linear, height 0.5s linear,
                      border-radius 0.5s linear, background 0.3s ease,
                      border-color 0.3s ease, box-shadow 0.3s ease;
          overflow: hidden;
        }
        .hukm-download-btn:hover:not(:disabled) {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgb(var(--surface-container-high));
          border-color: rgb(var(--accent-cyan));
          box-shadow: 0 0 1em 0.5em rgba(0, 0, 0, 0.2),
                      0 0 0.5em 0.1em rgba(90, 200, 250, 0.15);
        }
        .hukm-download-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .hukm-download-btn .hukm-dl-text {
          transition: opacity 0.25s ease;
          white-space: nowrap;
        }
        .hukm-download-btn:hover:not(:disabled) .hukm-dl-text {
          opacity: 0;
          width: 0;
          overflow: hidden;
        }
        .hukm-download-btn .hukm-dl-icon {
          position: absolute;
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
        }
        .hukm-download-btn:hover:not(:disabled) .hukm-dl-icon {
          opacity: 1;
        }
        .hukm-download-btn:hover:not(:disabled)::before {
          content: '';
          position: absolute;
          top: -3px;
          left: -3px;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top: 3px solid rgb(var(--accent-cyan));
          border-right: 3px solid rgb(var(--accent-cyan));
          border-radius: 50%;
          animation: hukm-download-spin 2s linear infinite;
          pointer-events: none;
        }
      `}</style>

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
