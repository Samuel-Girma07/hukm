"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ScenarioForm from "@/components/ScenarioForm";
import ErrorState from "@/components/ErrorState";
import { ScenarioInput } from "@/lib/types";
import { getDisplayName, DEFAULT_MODEL_ID } from "@/lib/models";
import { logger } from "@/lib/logger";

interface RetrievedChunkPreview {
  id: number;
  documentName: string;
  articleReference: string;
  similarity: number;
}

type Phase =
  | "idle"
  | "retrieving"
  | "drafting"
  | "saving"
  | "done"
  | "error";

interface ProgressState {
  phase: Phase;
  chunks: RetrievedChunkPreview[];
  draft: string;
}

const INITIAL_PROGRESS: ProgressState = {
  phase: "idle",
  chunks: [],
  draft: "",
};

interface AnalyzeStreamEvent {
  type: "status" | "chunks" | "delta" | "done" | "error";
  phase?: string;
  chunks?: RetrievedChunkPreview[];
  content?: string;
  resultId?: string;
  error?: string;
}

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedModelId, setSubmittedModelId] =
    useState<string>(DEFAULT_MODEL_ID);
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);

  const reset = () => {
    setError(null);
    setProgress(INITIAL_PROGRESS);
  };

  const handleSubmit = async (input: ScenarioInput) => {
    setSubmittedModelId(input.modelId);
    setIsLoading(true);
    reset();
    setProgress((p) => ({ ...p, phase: "retrieving" }));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(input),
      });

      // Non-OK -> server already wrote a JSON error body.
      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
          const json = await response.json();
          if (json?.error) message = json.error;
        } catch {
          /* not JSON */
        }
        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") ?? "";
      // Streaming branch
      if (contentType.includes("application/x-ndjson") && response.body) {
        const resultId = await consumeAnalyzeStream(
          response.body,
          setProgress,
        );
        router.push(`/results/${resultId}`);
        return;
      }

      // Fallback: server didn't honour the Accept header for some reason.
      const json = await response.json();
      if (!json?.success || !json.resultId) {
        throw new Error(json?.error ?? "Server did not return a result");
      }
      router.push(`/results/${json.resultId}`);
    } catch (err) {
      logger.error("Analyze flow failed:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setProgress((p) => ({ ...p, phase: "error" }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Ethiopian Sentencing Assistant
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered legal analysis for Ethiopian criminal law. Describe your
          scenario and receive structured legal analysis based on retrieved
          law articles.
        </p>
      </div>

      {error && <ErrorState error={error} onRetry={() => reset()} />}

      {isLoading ? (
        <AnalyzeProgressView
          modelName={getDisplayName(submittedModelId)}
          progress={progress}
        />
      ) : (
        <ScenarioForm onSubmit={handleSubmit} />
      )}
    </div>
  );
}

// ============================================================================
// PROGRESS UI
// ============================================================================

function AnalyzeProgressView({
  modelName,
  progress,
}: {
  modelName: string;
  progress: ProgressState;
}) {
  const phaseLabel: Record<Phase, string> = {
    idle: "Preparing analysis…",
    retrieving: "Retrieving relevant Ethiopian law articles…",
    drafting: "Drafting analysis with " + modelName + "…",
    saving: "Saving result…",
    done: "Done.",
    error: "Something went wrong.",
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <p className="text-base font-medium text-gray-900 dark:text-white">
          {phaseLabel[progress.phase]}
        </p>
      </div>

      <ol className="text-sm text-gray-600 dark:text-gray-400 list-none space-y-1.5">
        <PhaseRow
          done={progress.phase !== "retrieving" && progress.phase !== "idle"}
          active={progress.phase === "retrieving"}
        >
          Retrieve relevant law articles
          {progress.chunks.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              · {progress.chunks.length} article
              {progress.chunks.length === 1 ? "" : "s"} found
            </span>
          )}
        </PhaseRow>
        <PhaseRow
          done={progress.phase === "saving" || progress.phase === "done"}
          active={progress.phase === "drafting"}
        >
          Draft 7-step analysis
          {progress.draft.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              · {Math.min(99, Math.floor((progress.draft.length / 4000) * 100))}%
              streamed
            </span>
          )}
        </PhaseRow>
        <PhaseRow done={progress.phase === "done"} active={false}>
          Save and open results
        </PhaseRow>
      </ol>

      {progress.chunks.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Retrieved articles
          </p>
          <ul className="space-y-1 text-sm">
            {progress.chunks.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex justify-between gap-3 text-gray-700 dark:text-gray-300"
              >
                <span className="truncate">
                  {c.articleReference || c.documentName}
                </span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {(c.similarity * 100).toFixed(0)}%
                </span>
              </li>
            ))}
            {progress.chunks.length > 6 && (
              <li className="text-xs text-gray-500">
                + {progress.chunks.length - 6} more
              </li>
            )}
          </ul>
        </div>
      )}

      {progress.phase === "drafting" && progress.draft.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Draft (live)
          </p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 max-h-64 overflow-y-auto">
            {tailDraftPreview(progress.draft)}
          </pre>
        </div>
      )}
    </div>
  );
}

function PhaseRow({
  done,
  active,
  children,
}: {
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          done
            ? "h-2 w-2 rounded-full bg-emerald-500"
            : active
              ? "h-2 w-2 rounded-full bg-blue-500 animate-pulse"
              : "h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"
        }
        aria-hidden
      />
      <span
        className={
          active
            ? "text-gray-900 dark:text-white"
            : done
              ? "text-gray-700 dark:text-gray-300"
              : ""
        }
      >
        {children}
      </span>
    </li>
  );
}

/**
 * The model usually emits long structured JSON. Showing the tail of it is
 * more useful than the head — the user can watch tokens land — and keeps
 * the box from growing arbitrarily.
 */
function tailDraftPreview(text: string, lines = 18): string {
  const split = text.split("\n");
  if (split.length <= lines) return text;
  return "…\n" + split.slice(-lines).join("\n");
}

// ============================================================================
// STREAM CONSUMER
// ============================================================================

async function consumeAnalyzeStream(
  body: ReadableStream<Uint8Array>,
  setProgress: React.Dispatch<React.SetStateAction<ProgressState>>,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let resultId: string | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");

        if (!line) continue;
        let event: AnalyzeStreamEvent;
        try {
          event = JSON.parse(line) as AnalyzeStreamEvent;
        } catch {
          // Tolerate occasional bad lines silently.
          continue;
        }

        if (event.type === "status" && event.phase) {
          const phase = event.phase as Phase;
          setProgress((p) => ({ ...p, phase }));
        } else if (event.type === "chunks" && event.chunks) {
          const incoming = event.chunks;
          setProgress((p) => ({ ...p, chunks: incoming }));
        } else if (event.type === "delta" && event.content) {
          const piece = event.content;
          setProgress((p) => ({ ...p, draft: p.draft + piece }));
        } else if (event.type === "done" && event.resultId) {
          resultId = event.resultId;
          setProgress((p) => ({ ...p, phase: "done" }));
        } else if (event.type === "error") {
          throw new Error(event.error ?? "Streaming failed");
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  if (!resultId) {
    throw new Error("Server did not return a result");
  }
  return resultId;
}
