/**
 * HUKM — NVIDIA chat client.
 *
 * Two entry points:
 *
 *   callChat({ modelId, messages, ... })
 *       → calls a SINGLE model. Throws on transport / 5xx errors so the
 *         caller can decide whether to retry.
 *
 *   callChatWithFallback({ modelId, messages, ... })
 *       → walks the fallback chain returned by `getFallbackChain(modelId)`.
 *         The first model that answers successfully wins. The caller gets
 *         back the model id that actually responded (so it can log /
 *         persist the truth, not the originally-requested model).
 *
 * Streaming is exposed separately as `streamChat`, which yields incremental
 * delta strings as they arrive on the SSE stream. Non-streaming callers
 * should use `callChat` / `callChatWithFallback`.
 */

import "server-only";

import { env } from "./env";
import { logger } from "./logger";
import { CHAT_ENDPOINT, getFallbackChain, getModelThinkingConfig } from "./models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallChatOptions {
  modelId: string;
  messages: ChatMessage[];
  /** Defaults to 0.1 for analysis-grade output. */
  temperature?: number;
  /** Defaults to 2048; analysis prompts can need 2-3k. */
  maxTokens?: number;
  /** Forwards an AbortSignal so callers can cancel in-flight requests. */
  signal?: AbortSignal;
}

export interface CallChatResult {
  /** The textual reply (assistant content). */
  content: string;
  /** The model id that actually answered (may differ from requested if fallback). */
  modelId: string;
}

interface ChatApiResponse {
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: { total_tokens?: number };
}

// ---------------------------------------------------------------------------
// Single-model call
// ---------------------------------------------------------------------------

const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 2048;

interface ChatRequestBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
  chat_template_kwargs?: { enable_thinking: boolean };
}

function buildRequestBody(
  options: CallChatOptions,
  stream: boolean,
): ChatRequestBody {
  const body: ChatRequestBody = {
    model: options.modelId,
    messages: options.messages,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream,
  };
  const thinking = getModelThinkingConfig(options.modelId);
  if (thinking) {
    body.chat_template_kwargs = thinking;
  }
  return body;
}

export async function callChat(options: CallChatOptions): Promise<CallChatResult> {
  const start = Date.now();

  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildRequestBody(options, false)),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new ChatApiError(
      `NVIDIA chat API error (HTTP ${response.status}) for model ${options.modelId}: ${text || "no body"}`,
      response.status,
    );
    logger.error("[nvidia] chat call failed", {
      status: response.status,
      modelId: options.modelId,
      durationMs: Date.now() - start,
      bodyExcerpt: text.slice(0, 300),
    });
    throw error;
  }

  const data = (await response.json()) as ChatApiResponse;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ChatApiError(
      `NVIDIA chat API returned an empty response for model ${options.modelId}`,
      502,
    );
  }

  logger.info("[nvidia] chat call succeeded", {
    modelId: options.modelId,
    durationMs: Date.now() - start,
    finishReason: data.choices?.[0]?.finish_reason,
    totalTokens: data.usage?.total_tokens,
  });

  return { content, modelId: options.modelId };
}

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

export async function callChatWithFallback(
  options: CallChatOptions,
): Promise<CallChatResult> {
  const chain = getFallbackChain(options.modelId);
  let lastError: unknown = null;

  for (const candidate of chain) {
    try {
      const result = await callChat({ ...options, modelId: candidate });
      if (candidate !== options.modelId) {
        logger.warn("[nvidia] primary model failed; fallback succeeded", {
          requested: options.modelId,
          actual: candidate,
        });
      }
      return result;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) {
        // Client-side issue (validation, auth, etc.) — don't try fallbacks.
        throw err;
      }
      logger.warn("[nvidia] candidate failed, trying next in chain", {
        candidate,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ChatApiError(
        "All NVIDIA chat models in the fallback chain failed.",
        503,
      );
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

/**
 * Async-iterable streaming entry point. Yields incremental content
 * deltas as they arrive. Throws on non-2xx upstream responses.
 *
 * Usage:
 *   for await (const delta of streamChat({...})) { ... }
 */
export async function* streamChat(
  options: CallChatOptions,
): AsyncGenerator<string, void, void> {
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(buildRequestBody(options, true)),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new ChatApiError(
      `NVIDIA stream error (HTTP ${response.status}) for ${options.modelId}: ${text || "no body"}`,
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        const parsed = JSON.parse(payload) as StreamChunk;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) yield delta;
      } catch (err) {
        logger.warn("[nvidia] could not parse SSE chunk", {
          payload: payload.slice(0, 120),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ChatApiError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof ChatApiError) {
    // 5xx and 429 are worth retrying with a different model. 4xx
    // (validation, auth) means we've sent something fundamentally bad.
    return err.status >= 500 || err.status === 429 || err.status === 408;
  }
  // Network-level errors: assume transient.
  return true;
}
