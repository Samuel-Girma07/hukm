"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

import { useT } from "@/contexts/LanguageContext";
import type { CreateConversationResponse } from "@/lib/types";

interface SuggestedQuestionsProps {
  questions: string[];
  conversationId?: string | null;
  analysisId?: string;
  scenarioDescription?: string;
  modelId?: string;
  className?: string;
}

export function SuggestedQuestions({
  questions,
  conversationId,
  analysisId,
  scenarioDescription,
  modelId,
  className = "",
}: SuggestedQuestionsProps): React.ReactElement | null {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!questions || questions.length === 0) return null;

  async function handle(index: number, question: string): Promise<void> {
    setError(null);
    setPending(index);
    try {
      let convId = conversationId ?? null;
      if (!convId) {
        if (!analysisId || !scenarioDescription || !modelId) {
          setError(t("common.error"));
          return;
        }
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioDescription,
            modelId,
            analysisId,
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | CreateConversationResponse
          | null;
        if (!response.ok || !data || !data.success) {
          const msg =
            data && !data.success && "error" in data
              ? data.error
              : `HTTP ${response.status}`;
          setError(msg);
          return;
        }
        convId = data.conversationId;
      }
      router.push(`/chat/${convId}?q=${encodeURIComponent(question)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-[15px] font-semibold text-on-surface">
        {t("results.suggestedFollowUps")}
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {questions.slice(0, 3).map((question, idx) => (
          <button
            key={`${idx}-${question}`}
            type="button"
            onClick={() => void handle(idx, question)}
            disabled={pending !== null}
            className="
              group flex items-start gap-3 rounded-[12px]
              border border-[rgb(var(--border-subtle))]
              bg-[rgb(var(--surface-elevated))]
              px-4 py-3 text-left
              transition-[background-color,border-color] duration-150 ease-out
              hover:bg-[rgb(var(--surface-overlay))]
              hover:border-[rgb(var(--border-visible))]
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            <span className="mt-0.5 shrink-0 text-on-surface-variant transition-colors group-hover:text-[rgb(var(--accent-cyan))]">
              {pending === idx ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Icon name="search" size={14} />
              )}
            </span>
            <span className="text-[13px] leading-snug text-on-surface">
              {question}
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-[12px] text-[rgb(var(--accent-red))]">{error}</p>
      ) : null}
    </section>
  );
}
