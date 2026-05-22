"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArticlePanel } from "./ArticlePanel";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ErrorState, InlineError } from "./ErrorState";
import { Icon } from "./Icon";
import { MessageBubble, ThinkingBubble } from "./MessageBubble";
import BorderGlow from "./BorderGlow";

import { useT } from "@/contexts/LanguageContext";
import { getModelTierLabel } from "@/lib/models";
import { parseSSEStream } from "@/lib/streaming";
import type { ConfidenceLevel, LawChunk } from "@/lib/types";

const MESSAGE_MAX = 5000;

interface InitialMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ConversationSummary {
  id: string;
  scenario_description: string | null;
  model_id: string;
  confidence_level: ConfidenceLevel | null;
  is_civil_matter: boolean;
  needs_clarification: boolean;
}

interface ChatInterfaceProps {
  conversation: ConversationSummary;
  initialMessages: InitialMessage[];
  sessionId: string;
}

interface UiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  retrievedChunks?: LawChunk[];
  timestamp: string;
  streaming?: boolean;
}

function extractChunks(metadata: Record<string, unknown> | null): LawChunk[] {
  if (!metadata) return [];
  const raw = metadata.retrievedChunks;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c, i) => ({
      id: typeof c.id === "number" ? c.id : i,
      document_name:
        typeof c.document_name === "string" ? c.document_name : "Unknown source",
      article_reference:
        typeof c.article_reference === "string"
          ? c.article_reference
          : "Unknown article",
      content: typeof c.content === "string" ? c.content : "",
      similarity: typeof c.similarity === "number" ? c.similarity : 0,
    }));
}

export function ChatInterface({
  conversation,
  initialMessages,
  sessionId,
}: ChatInterfaceProps): React.ReactElement {
  const t = useT();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<UiMessage[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      retrievedChunks: m.role === "assistant" ? extractChunks(m.metadata) : [],
      timestamp: m.created_at,
    })),
  );
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [openChunk, setOpenChunk] = useState<LawChunk | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const listEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = useCallback(
    async (rawText: string): Promise<void> => {
      const trimmed = rawText.trim();
      if (!trimmed) {
        setValidation(t("chat.empty"));
        return;
      }
      if (trimmed.length > MESSAGE_MAX) {
        setValidation(`Message must be under ${MESSAGE_MAX} characters.`);
        return;
      }
      setValidation(null);
      setError(null);

      const optimisticId = `optimistic-${Date.now()}`;
      const placeholderId = `placeholder-${Date.now()}`;
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: optimisticId, role: "user", content: trimmed, timestamp: now },
        {
          id: placeholderId,
          role: "assistant",
          content: "",
          timestamp: now,
          streaming: true,
        },
      ]);
      setDraft("");
      setSubmitting(true);

      try {
        const response = await fetch("/api/chat?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversation.id,
            sessionId,
          }),
        });

        if (!response.ok) {
          let msg = `HTTP ${response.status}`;
          try {
            const data = (await response.json()) as { error?: string };
            if (data.error) msg = data.error;
          } catch {
            // ignore
          }
          setError(msg);
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          return;
        }

        let assembled = "";
        let chunks: LawChunk[] = [];
        for await (const event of parseSSEStream(response)) {
          if (event.type === "token") {
            assembled += event.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, content: assembled } : m,
              ),
            );
          } else if (event.type === "done") {
            if (Array.isArray(event.retrievedChunks)) {
              chunks = event.retrievedChunks as LawChunk[];
            }
            const finalContent =
              typeof event.response === "string" && event.response.length > 0
                ? event.response
                : assembled;
            const finalId = event.messageId ?? placeholderId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      id: finalId,
                      role: "assistant",
                      content: finalContent,
                      retrievedChunks: chunks,
                      timestamp: new Date().toISOString(),
                    }
                  : m,
              ),
            );
            return;
          } else if (event.type === "error") {
            setError(event.error);
            setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
            return;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      } finally {
        setSubmitting(false);
        textareaRef.current?.focus();
      }
    },
    [conversation.id, sessionId, t],
  );

  useEffect(() => {
    if (autoSubmittedRef.current) return;
    const q = searchParams?.get("q");
    if (!q || q.trim().length === 0) return;
    autoSubmittedRef.current = true;
    void send(q);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!submitting) void send(draft);
    }
  }

  const visible = messages.filter((m) => m.role !== "system");
  const lastMessagePending =
    messages.length > 0 && messages[messages.length - 1]?.streaming === true;
  const lastContent = messages[messages.length - 1]?.content ?? "";
  const showThinking = submitting && lastMessagePending && lastContent.length === 0;

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] flex-col">
      {/* Mobile context toggle */}
      <button
        type="button"
        onClick={() => setContextOpen((v) => !v)}
        className="
          fixed right-4 top-[4.25rem] z-30 inline-flex items-center gap-1.5
          rounded-full border border-[rgb(var(--border-subtle))]
          bg-[rgb(var(--surface-elevated)/0.95)] backdrop-blur
          px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant
          transition-colors hover:text-on-surface
          md:hidden
        "
      >
        <span>
          {contextOpen
            ? t("chat.hideContext") || "Hide context"
            : t("chat.showContext") || "Show context"}
        </span>
        <Icon
          name="expand_more"
          size={14}
          className={contextOpen ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      <div className="flex flex-1 gap-5">
        <ContextPane
          conversation={conversation}
          collapsed={!contextOpen}
        />

        <section className="relative flex flex-1 flex-col">
          {/* Messages */}
          <div className="scrollbar-slim flex-1 overflow-y-auto pb-[180px] pt-4">
            <div className="mx-auto flex max-w-[820px] flex-col gap-6 px-1">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    {t("nav.compare") || "Conversation"}
                  </p>
                  <p className="text-[28px] font-semibold tracking-tight text-on-surface">
                    {t("chat.empty")}
                  </p>
                </div>
              ) : (
                visible.map((message) =>
                  message.streaming && message.content.length === 0 ? null : (
                    <MessageBubble
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      retrievedChunks={message.retrievedChunks}
                      timestamp={message.timestamp}
                      onOpenChunk={(c) => setOpenChunk(c)}
                      streaming={message.streaming}
                    />
                  ),
                )
              )}
              {showThinking ? <ThinkingBubble /> : null}
              <div ref={listEndRef} />
            </div>
          </div>

          {/* Floating composer with BorderGlow */}
          <footer className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="bg-gradient-to-t from-[rgb(var(--bg))] via-[rgb(var(--bg))] to-transparent pt-12">
              <div className="pointer-events-auto mx-auto flex max-w-[820px] flex-col gap-2 px-1 pb-2">
                {error ? (
                  <ErrorState message={error} onRetry={() => setError(null)} />
                ) : null}
                {validation ? <InlineError message={validation} /> : null}
                <BorderGlow
                  backgroundColor="rgb(28, 28, 30)"
                  borderRadius={18}
                  glowRadius={20}
                  glowIntensity={0.8}
                  edgeSensitivity={25}
                  coneSpread={20}
                  colors={['#5AC8FA', '#0A84FF', '#c084fc']}
                  focused={focused}
                  className="w-full focus-within:border-[rgb(var(--focus))]"
                >
                  <div className="flex items-end gap-2 p-2 sm:p-2.5">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      className="
                        min-h-[44px] flex-1 resize-none border-none bg-transparent
                        px-2 py-2 text-[15px] leading-relaxed text-on-surface
                        placeholder:text-[rgb(var(--text-muted))]
                        focus:outline-none focus:ring-0
                      "
                      placeholder={t("chat.placeholder")}
                      value={draft}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      onKeyDown={handleKeyDown}
                      disabled={submitting}
                      maxLength={MESSAGE_MAX + 50}
                      aria-label="Message"
                    />
                    <button
                      type="button"
                      onClick={() => void send(draft)}
                      disabled={submitting || draft.trim().length === 0}
                      aria-label={t("chat.send")}
                      className="
                        mb-0.5 mr-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full
                        bg-white text-[#0A0A0A]
                        transition-[background-color,transform] duration-150 ease-out
                        hover:bg-[#EBEBF5]
                        motion-safe:active:scale-95
                        disabled:cursor-not-allowed
                        disabled:bg-[rgb(var(--surface-overlay))]
                        disabled:text-on-surface-variant
                      "
                    >
                      <Icon name="send" size={14} filled />
                    </button>
                  </div>
                </BorderGlow>
                <p className="px-2 text-[11px] text-on-surface-variant/70">
                  {t("chat.sendShortcut")}{" "}
                  <span className="opacity-50 mx-1">·</span> {draft.length} /{" "}
                  {MESSAGE_MAX}
                </p>
              </div>
            </div>
          </footer>

          <ArticlePanel chunk={openChunk} onClose={() => setOpenChunk(null)} />
        </section>
      </div>
    </div>
  );
}

interface ContextPaneProps {
  conversation: ConversationSummary;
  collapsed: boolean;
}

function ContextPane({
  conversation,
  collapsed,
}: ContextPaneProps): React.ReactElement {
  const t = useT();
  return (
    <aside
      className={`w-full shrink-0 overflow-y-auto md:flex md:w-[300px] ${
        collapsed ? "hidden" : "flex"
      } flex-col`}
    >
      <div className="h-full rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]">
        <div className="flex h-full flex-col gap-5 p-5">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {t("chat.conversationLabel")}
            </p>
            <h2 className="text-[20px] font-semibold tracking-tight text-on-surface">
              Active scenario
            </h2>
          </div>

          {conversation.confidence_level ? (
            <ConfidenceBadge level={conversation.confidence_level} />
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Scenario summary
            </h3>
            <p className="text-[14px] leading-relaxed text-on-surface">
              {conversation.scenario_description ?? t("chat.untitled")}
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-[rgb(var(--border-subtle))] pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Model
            </h3>
            <p className="text-[16px] font-semibold tracking-tight text-on-surface">
              {getModelTierLabel(conversation.model_id)}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
