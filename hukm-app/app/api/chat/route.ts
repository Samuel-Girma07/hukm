/**
 * POST /api/chat
 *
 * Buffered or streaming, depending on whether `?stream=true` is in the URL.
 *
 * 1. Validates body length (1–5000 chars).
 * 2. Verifies session ownership of the conversation.
 * 3. Loads the last 20 messages.
 * 4. Runs RAG retrieval over the new user message.
 * 5. Builds the chat prompt and calls NVIDIA.
 * 6. Persists user + assistant messages.
 * 7. Returns the assistant reply.
 */

import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";

import { trackEvent } from "@/lib/analytics";
import { env } from "@/lib/env";
import { hashSession } from "@/lib/hash";
import { jsonError } from "@/lib/http";
import { logger, requestLogger } from "@/lib/logger";
import {
  CHAT_ENDPOINT,
  getFallbackChain,
  getModelThinkingConfig,
} from "@/lib/models";
import { callChatWithFallback, ChatApiError } from "@/lib/nvidia";
import { isConversationOwner } from "@/lib/ownership";
import { buildChatPrompt } from "@/lib/prompts";
import {
  checkRateLimit,
  identifyClient,
  rateLimitHeaders,
  type RateLimitOutcome,
} from "@/lib/ratelimit";
import { retrieveContext } from "@/lib/retrieval";
import {
  setRequestContext,
  captureException,
} from "@/lib/sentry";
import { readSessionId } from "@/lib/session";
import { encodeSSE } from "@/lib/streaming";
import { getServerClient } from "@/lib/supabase";
import type { ChatResponse, LawChunk, RetrievalResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_MIN_LENGTH = 1;
const MESSAGE_MAX_LENGTH = 5000;
const HISTORY_LIMIT = 20;

interface ValidatedChatBody {
  message: string;
  conversationId: string;
  sessionId: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateBody(raw: unknown): ValidatedChatBody | string {
  if (!isObject(raw)) return "Request body must be a JSON object.";

  const message = raw.message;
  if (typeof message !== "string") return "`message` must be a string.";
  const trimmed = message.trim();
  if (trimmed.length < MESSAGE_MIN_LENGTH) return "`message` cannot be empty.";
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return `\`message\` must not exceed ${MESSAGE_MAX_LENGTH} characters.`;
  }

  const conversationId = raw.conversationId;
  if (typeof conversationId !== "string" || conversationId.trim().length === 0) {
    return "`conversationId` is required.";
  }

  const sessionId = raw.sessionId;
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return "`sessionId` is required.";
  }

  return { message: trimmed, conversationId, sessionId };
}

interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface ConversationContextRow {
  model_id: string;
  scenario_description: string | null;
}

interface PreparedRequest {
  message: string;
  conversationId: string;
  cookieSessionId: string;
  modelId: string;
  scenarioDescription: string | null;
  history: MessageRow[];
  retrieval: RetrievalResult;
  /**
   * The rate-limit outcome from the single checkRateLimit() call inside
   * prepareRequest(). Reused by the POST handler to attach X-RateLimit-*
   * headers to the 200 response WITHOUT calling checkRateLimit() a
   * second time (which would double-charge the user's quota).
   */
  rateLimit: RateLimitOutcome;
}

async function prepareRequest(
  raw: unknown,
  request: NextRequest,
): Promise<
  | { ok: true; data: PreparedRequest }
  | { ok: false; status: number; error: string; code: string; headers?: Record<string, string> }
> {
  const validated = validateBody(raw);
  if (typeof validated === "string") {
    return { ok: false, status: 400, error: validated, code: "VALIDATION" };
  }

  const cookieSessionId = await readSessionId();
  if (!cookieSessionId || cookieSessionId !== validated.sessionId) {
    return {
      ok: false,
      status: 403,
      error: "Session mismatch.",
      code: "SESSION_MISMATCH",
    };
  }

  const owns = await isConversationOwner(validated.conversationId, cookieSessionId);
  if (!owns) {
    return {
      ok: false,
      status: 404,
      error: "Conversation not found, or you don't have access to it.",
      code: "NOT_FOUND",
    };
  }

  const supabase = getServerClient();
  const conversationLookup = await supabase
    .from("conversations")
    .select("model_id, scenario_description")
    .eq("id", validated.conversationId)
    .maybeSingle<ConversationContextRow>();

  if (conversationLookup.error || !conversationLookup.data) {
    logger.error("[chat] failed to read conversation", {
      conversationId: validated.conversationId,
      error: conversationLookup.error?.message,
    });
    return {
      ok: false,
      status: 500,
      error: "Could not load conversation.",
      code: "DB_READ",
    };
  }

  const rateLimit = await checkRateLimit(cookieSessionId, conversationLookup.data.model_id);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded. Retry after ${rateLimit.retryAfterSeconds} seconds.`,
      code: "RATE_LIMIT",
      headers: rateLimitHeaders(rateLimit),
    };
  }

  const messagesLookup = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", validated.conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)
    .returns<MessageRow[]>();

  if (messagesLookup.error) {
    logger.error("[chat] failed to load history", {
      conversationId: validated.conversationId,
      error: messagesLookup.error.message,
    });
    return {
      ok: false,
      status: 500,
      error: "Could not load conversation history.",
      code: "DB_READ",
    };
  }

  const history = (messagesLookup.data ?? []).slice().reverse();
  const retrieval = await retrieveContext(validated.message);

  return {
    ok: true,
    data: {
      message: validated.message,
      conversationId: validated.conversationId,
      cookieSessionId,
      modelId: conversationLookup.data.model_id,
      scenarioDescription: conversationLookup.data.scenario_description,
      history,
      retrieval,
      rateLimit,
    },
  };
}

interface PersistChatTurnArgs {
  conversationId: string;
  userMessage: string;
  assistantContent: string;
  modelId: string;
  retrievedChunks: LawChunk[];
}

async function persistChatTurn(
  args: PersistChatTurnArgs,
): Promise<{ ok: boolean; assistantId?: string }> {
  const supabase = getServerClient();
  const insertResult = await supabase
    .from("messages")
    .insert([
      {
        conversation_id: args.conversationId,
        role: "user",
        content: args.userMessage,
        metadata: null,
      },
      {
        conversation_id: args.conversationId,
        role: "assistant",
        content: args.assistantContent,
        metadata: {
          model: args.modelId,
          retrievedChunks: args.retrievedChunks.map((c) => ({
            id: c.id,
            article_reference: c.article_reference,
            similarity: c.similarity,
          })),
        },
      },
    ])
    .select("id, role")
    .returns<Array<{ id: string; role: string }>>();

  if (insertResult.error) {
    logger.error("[chat] failed to persist messages", {
      conversationId: args.conversationId,
      error: insertResult.error.message,
    });
    return { ok: false };
  }

  const assistantRow = (insertResult.data ?? []).find((r) => r.role === "assistant");
  return { ok: true, assistantId: assistantRow?.id };
}

// ---------------------------------------------------------------------------
// Buffered handler
// ---------------------------------------------------------------------------

async function handleBuffered(
  prepared: PreparedRequest,
  rateLimitHeadersOut: Record<string, string>,
): Promise<NextResponse<ChatResponse>> {
  const requestId = nanoid(10);
  const reqLog = requestLogger({
    requestId,
    endpoint: "/api/chat",
    sessionIdHash: hashSession(prepared.cookieSessionId),
    modelId: prepared.modelId,
    inputLength: prepared.message.length,
  });

  const systemPrompt = buildChatPrompt({
    retrieval: prepared.retrieval,
    priorAnalysisSummary: prepared.scenarioDescription
      ? `Original scenario: ${prepared.scenarioDescription}`
      : null,
  });

  const messagesForModel: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...prepared.history.map((row) => ({
      role: (row.role === "system" ? "user" : (row.role as "user" | "assistant")),
      content: row.content,
    })),
    { role: "user" as const, content: prepared.message },
  ];

  const chatStart = Date.now();
  let assistantContent: string;
  let actualModelId: string;
  try {
    const result = await callChatWithFallback({
      modelId: prepared.modelId,
      messages: messagesForModel,
      maxTokens: 1024,
    });
    assistantContent = result.content.trim();
    actualModelId = result.modelId;
  } catch (err) {
    captureException(err, { endpoint: "/api/chat" });
    reqLog.error({ err }, "NVIDIA call failed");
    return jsonError(
      503,
      "The AI service is currently unavailable. Please try again in a moment.",
      "AI_UPSTREAM",
    );
  }
  reqLog.info(
    {
      requestedModel: prepared.modelId,
      actualModel: actualModelId,
      durationMs: Date.now() - chatStart,
      replyChars: assistantContent.length,
    },
    "chat call complete",
  );

  const persisted = await persistChatTurn({
    conversationId: prepared.conversationId,
    userMessage: prepared.message,
    assistantContent,
    modelId: actualModelId,
    retrievedChunks: prepared.retrieval.chunks,
  });

  if (!persisted.ok) {
    return jsonError(
      500,
      "Reply was generated but could not be saved. Please try again.",
      "PERSIST_FAILED",
    );
  }

  trackEvent({
    eventType: "chat",
    sessionId: prepared.cookieSessionId,
    modelId: actualModelId,
    metadata: { conversationId: prepared.conversationId, requestId },
  });

  return NextResponse.json(
    {
      success: true,
      conversationId: prepared.conversationId,
      messageId: persisted.assistantId ?? "",
      response: assistantContent,
      retrievedChunks: prepared.retrieval.chunks,
    },
    { headers: rateLimitHeadersOut },
  );
}

// ---------------------------------------------------------------------------
// Streaming handler
// ---------------------------------------------------------------------------

interface ChatStreamRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  stream: boolean;
  chat_template_kwargs?: { enable_thinking: boolean };
}

async function streamFromCandidate(args: {
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  signal: AbortSignal;
  onToken: (delta: string) => void;
}): Promise<string> {
  const body: ChatStreamRequestBody = {
    model: args.modelId,
    messages: args.messages,
    temperature: 0.1,
    max_tokens: 1024,
    stream: true,
  };
  const thinking = getModelThinkingConfig(args.modelId);
  if (thinking) {
    body.chat_template_kwargs = thinking;
  }

  const upstream = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    throw new ChatApiError(
      `NVIDIA stream error (HTTP ${upstream.status}) for ${args.modelId}: ${text || "no body"}`,
      upstream.status,
    );
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            assembled += delta;
            args.onToken(delta);
          }
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return assembled;
}

function handleStreaming(
  prepared: PreparedRequest,
  rateLimitHeadersOut: Record<string, string>,
  request: NextRequest,
): Response {
  const requestId = nanoid(10);
  const reqLog = requestLogger({
    requestId,
    endpoint: "/api/chat#stream",
    sessionIdHash: hashSession(prepared.cookieSessionId),
    modelId: prepared.modelId,
  });

  const systemPrompt = buildChatPrompt({
    retrieval: prepared.retrieval,
    priorAnalysisSummary: prepared.scenarioDescription
      ? `Original scenario: ${prepared.scenarioDescription}`
      : null,
  });

  const messagesForModel: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...prepared.history.map((row) => ({
      role: (row.role === "system" ? "user" : (row.role as "user" | "assistant")),
      content: row.content,
    })),
    { role: "user" as const, content: prepared.message },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const enqueue = (event: Parameters<typeof encodeSSE>[0]): void => {
        if (closed) return;
        try {
          controller.enqueue(encodeSSE(event));
        } catch {
          // ignore
        }
      };
      const closeStream = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      try {
        const chain = getFallbackChain(prepared.modelId);
        let assembled = "";
        let actualModelId: string | null = null;
        let lastError: ChatApiError | null = null;

        for (const candidate of chain) {
          try {
            assembled = await streamFromCandidate({
              modelId: candidate,
              messages: messagesForModel,
              signal: request.signal,
              onToken: (delta) => {
                if (delta.length === 0) return;
                enqueue({ type: "token", content: delta });
              },
            });
            actualModelId = candidate;
            break;
          } catch (err) {
            if (err instanceof ChatApiError) {
              if (err.status >= 500 || err.status === 429 || err.status === 408) {
                lastError = err;
                continue;
              }
              lastError = err;
              break;
            }
            throw err;
          }
        }

        if (!actualModelId || assembled.trim().length === 0) {
          captureException(lastError ?? new Error("All chat models failed"), {
            endpoint: "/api/chat",
          });
          enqueue({
            type: "error",
            error: "The AI service is currently unavailable. Please try again in a moment.",
            code: "AI_UPSTREAM",
          });
          enqueue("DONE");
          closeStream();
          return;
        }

        const persisted = await persistChatTurn({
          conversationId: prepared.conversationId,
          userMessage: prepared.message,
          assistantContent: assembled.trim(),
          modelId: actualModelId,
          retrievedChunks: prepared.retrieval.chunks,
        });

        if (!persisted.ok) {
          enqueue({
            type: "error",
            error: "Reply was generated but could not be saved. Please try again.",
            code: "PERSIST_FAILED",
          });
          enqueue("DONE");
          closeStream();
          return;
        }

        trackEvent({
          eventType: "chat",
          sessionId: prepared.cookieSessionId,
          modelId: actualModelId,
          metadata: {
            conversationId: prepared.conversationId,
            requestId,
            stream: true,
          },
        });

        enqueue({
          type: "done",
          conversationId: prepared.conversationId,
          messageId: persisted.assistantId,
          response: assembled.trim(),
          retrievedChunks: prepared.retrieval.chunks,
        });
        enqueue("DONE");
        closeStream();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          reqLog.info("client aborted chat stream");
        } else {
          captureException(err, { endpoint: "/api/chat" });
          reqLog.error({ err }, "chat stream crashed");
          try {
            enqueue({
              type: "error",
              error: "Unexpected streaming error.",
              code: "STREAM_ERROR",
            });
            enqueue("DONE");
          } catch {
            // ignore
          }
        }
        closeStream();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      ...rateLimitHeadersOut,
    },
  });
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ChatResponse> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  const prep = await prepareRequest(raw, request);
  if (!prep.ok) {
    return jsonError(prep.status, prep.error, prep.code, prep.headers);
  }

  setRequestContext({
    endpoint: "/api/chat",
    modelId: prep.data.modelId,
    sessionId: prep.data.cookieSessionId,
  });

  const wantsStream =
    new URL(request.url).searchParams.get("stream") === "true";
  // Reuse the rate-limit outcome from prepareRequest() — calling
  // checkRateLimit() again here would double-charge the user's quota.
  // We still attach the X-RateLimit-* headers to the 200 response so
  // clients can show remaining-quota UI.
  const headers = rateLimitHeaders(prep.data.rateLimit);

  if (wantsStream) {
    return handleStreaming(prep.data, headers, request);
  }
  return handleBuffered(prep.data, headers);
}
