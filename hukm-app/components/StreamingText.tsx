"use client";

import { useEffect, useRef, useState } from "react";

import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import { parseSSEStream, type StreamEvent } from "@/lib/streaming";

interface StreamingTextProps {
  endpoint: string;
  body: unknown;
  onComplete: (event: Extract<StreamEvent, { type: "done" }>) => void;
  onError: (message: string) => void;
}

export function StreamingText({
  endpoint,
  body,
  onComplete,
  onError,
}: StreamingTextProps): React.ReactElement {
  const t = useT();
  const [accumulated, setAccumulated] = useState("");
  const [phase, setPhase] = useState<"connecting" | "streaming" | "done" | "error">(
    "connecting",
  );
  const abortRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          let errMsg = `Request failed (HTTP ${response.status}).`;
          try {
            const data = (await response.json()) as { error?: string };
            if (data.error) errMsg = data.error;
          } catch {
            // ignore
          }
          if (!cancelled) {
            setPhase("error");
            onError(errMsg);
          }
          return;
        }
        if (!response.body) {
          if (!cancelled) {
            setPhase("error");
            onError("Empty response body.");
          }
          return;
        }
        if (!cancelled) setPhase("streaming");
        for await (const event of parseSSEStream(response)) {
          if (cancelled) break;
          if (event.type === "token") {
            setAccumulated((prev) => prev + event.content);
          } else if (event.type === "done") {
            completedRef.current = true;
            setPhase("done");
            onComplete(event);
            return;
          } else if (event.type === "error") {
            setPhase("error");
            onError(event.error);
            return;
          }
        }
        if (!cancelled && !completedRef.current) {
          setPhase("error");
          onError("Stream ended without a done event.");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setPhase("error");
        onError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(var(--accent-cyan))]">
        {phase === "connecting" || phase === "streaming" ? (
          <>
            <Spinner className="h-4 w-4" />
            <span>
              {phase === "connecting" ? t("common.loading") : t("home.analysing")}
            </span>
          </>
        ) : null}
      </div>
      <pre className="mt-4 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-on-surface">
        {accumulated}
        {phase === "streaming" ? (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-4 w-2 -translate-y-0.5 animate-cursorBlink bg-[rgb(var(--accent-blue))] align-middle"
          />
        ) : null}
      </pre>
    </div>
  );
}
