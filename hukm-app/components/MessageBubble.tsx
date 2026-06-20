"use client";

import { useState } from "react";

import { Icon } from "./Icon";
import { SourcesPanel } from "./SourcesPanel";

import { useT } from "@/contexts/LanguageContext";
import { formatTime } from "@/lib/date";
import type { LawChunk } from "@/lib/types";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  retrievedChunks?: LawChunk[];
  timestamp?: string;
  onOpenChunk?: (chunk: LawChunk) => void;
  streaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  retrievedChunks,
  timestamp,
  onOpenChunk,
  streaming = false,
}: MessageBubbleProps): React.ReactElement | null {
  const t = useT();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (role === "system") return null;

  const isUser = role === "user";
  const hasSources =
    !isUser && !!retrievedChunks && retrievedChunks.length > 0;

  if (isUser) {
    return (
      <div className="flex max-w-[85%] flex-col gap-1.5 self-end motion-safe:animate-riseIn">
        <div className="rounded-[16px] rounded-tr-[4px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] px-4 py-3 text-[15px] leading-relaxed text-on-surface">
          {content}
        </div>
        <span className="self-end px-2 text-[11px] text-on-surface-variant">
          {t("chat.you")}
          {timestamp ? <> · {formatTime(timestamp)}</> : null}
        </span>
      </div>
    );
  }

  return (
    <div className="flex max-w-[85%] flex-col gap-1.5 self-start motion-safe:animate-riseIn">
      <div className="relative px-1 text-[15px] leading-relaxed text-on-surface">
        <div className="whitespace-pre-wrap break-words">
          {content}
          {streaming ? (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-4 w-2 -translate-y-0.5 animate-cursorBlink bg-[rgb(var(--accent-blue))] align-middle"
            />
          ) : null}
        </div>
        {hasSources ? (
          <div className="mt-3 border-t border-[rgb(var(--border-subtle))] pt-2">
            <button
              type="button"
              onClick={() => setSourcesOpen((v) => !v)}
              aria-expanded={sourcesOpen}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <Icon
                name="chevron_right"
                size={12}
                className={`transition-transform duration-150 ${
                  sourcesOpen ? "rotate-90" : ""
                }`}
              />
              Sources ({retrievedChunks!.length})
            </button>
            {sourcesOpen ? (
              <div className="mt-3">
                <SourcesPanel
                  chunks={retrievedChunks!}
                  title={t("results.citedArticles")}
                  onOpenChunk={onOpenChunk}
                  layout="flat"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className="px-1 text-[11px] text-on-surface-variant">
        {t("chat.assistant")}
        {timestamp ? <> · {formatTime(timestamp)}</> : null}
      </span>
    </div>
  );
}

export function ThinkingBubble(): React.ReactElement {
  return (
    <div className="flex max-w-[85%] items-center gap-3 self-start px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant motion-safe:animate-riseIn">
      <span>AI is thinking</span>
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-[rgb(var(--accent-blue))]" />
        <span
          className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-[rgb(var(--accent-blue))]"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-[rgb(var(--accent-blue))]"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </div>
  );
}
