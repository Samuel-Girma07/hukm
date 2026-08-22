/**
 * HUKM — NVIDIA chat client.
 *
 *   callChat()                  single model under a hard per-attempt deadline
 *   callChatWithFallback()      walks the fallback chain under a chain deadline
 *   streamFromCandidate()       shared SSE streamer (analyze + chat routes)
 *
 * Endpoints/budgets are env-overridable so tests can target a local stub:
 *   NVIDIA_CHAT_URL            default integrate.api.nvidia.com/v1/chat/completions
 *   NVIDIA_CHAT_TIMEOUT_MS     buffered attempt      (45_000)
 *   NVIDIA_CHAIN_DEADLINE_MS   entire chain          (55_000)
 *   NVIDIA_STREAM_TTFB_MS      first byte on streams (20_000)
 *   NVIDIA_STREAM_TOTAL_MS     stream overall        (55_000)
 */

import "server-only";

import { env } from "./env";
import { logger } from "./logger";
import {
  CHAT_ENDPOINT,
  getFallbackChain,
  getModelThinkingConfig,
} from "./models";
import { withDeadline } from "./httpTimeout";

// ---------------------------------------------------------------------------
// Lazy configuration
// ---------------------------------------------------------------------------

function positiveNum(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function chatUrl(): string {
  return process.env.NVIDIA_CHAT_URL || CHAT_ENDPOINT;
}

export function chatAttemptTimeoutMs(): number {
  return positiveNum(process.env.NVIDIA_CHAT_TIMEOUT_MS, 45_000);
}

export function chainDeadlineMs(): number {
  return positiveNum(process.env.NVIDIA_CHAIN_DEADLINE_MS, 55_000);
}

export function streamTtfbTimeoutMs(): number {
  return positiveNum(process.env.NVIDIA_STREAM_TTFB_MS, 20_000);
}

export function streamTotalTimeoutMs(): number {
  return positiveNum(process.env.NVIDIA_STREAM_TOTAL_MS, 55_000);
}

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
  temperature?: number;
  maxTokens?: number;
  /** Caller-owned abort (e.g. request.signal). Deadlines stack on top. */
  signal?: AbortSignal;
}

export interface CallChatResult {
  content: string;
  /** Model that ACTUALLY answered (may differ after fallback). */
  modelId: string;
}

interface ChatApiResponse {
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: { total_tokens?: number };
}

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
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 2048,
    stream,
  };
  const thinking = getModelThinkingConfig(options.modelId);
  if (thinking) {
    body.chat_template_kwargs = thinking;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Single-model call (buffered)
// ---------------------------------------------------------------------------

export async function callChat(
  options: CallChatOptions,
): Promise<CallChatResult> {
  const start = Date.now();
  const budgetMs = chatAttemptTimeoutMs();
  const deadline = withDeadline(budgetMs, options.signal);

  try {
    const response = await fetch(chatUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildRequestBody(options, false)),
      signal: deadline.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error("[nvidia] chat call failed", {
        status: response.status,
        modelId: options.modelId,
        durationMs: Date.now() - start,
        bodyExcerpt: text.slice(0, 300),
      });
      throw new ChatApiError(
        `NVIDIA chat API error (HTTP ${response.status}) for model ${options.modelId}: ${text || "no body"}`,
        response.status,
      );
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
  } catch (err) {
    if (deadline.timedOut && !options.signal?.aborted) {
      throw new ChatApiError(
        `NVIDIA chat call timed out after ${budgetMs}ms for model ${options.modelId}`,
        504,
      );
    }
    throw err;
  } finally {
    deadline.cancel();
  }
}

// ---------------------------------------------------------------------------
// Fallback chain (buffered)
// ---------------------------------------------------------------------------

export async function callChatWithFallback(
  options: CallChatOptions,
): Promise<CallChatResult> {
  const chain = getFallbackChain(options.modelId);
  const chainStart = Date.now();
  const chainBudgetMs = chainDeadlineMs();
  let lastError: unknown = null;

  for (let i = 0; i < chain.length; i += 1) {
    const candidate = chain[i]!;
    // Reserve time for at least one meaningful attempt beyond the first.
    if (i > 0 && Date.now() - chainStart > chainBudgetMs - 500) {
      logger.warn("[nvidia] chain deadline exhausted; stopping fallback walk", {
        requested: options.modelId,
        elapsedMs: Date.now() - chainStart,
      });
      break;
    }
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
    : new ChatApiError("All NVIDIA chat models in the fallback chain failed.", 503);
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof ChatApiError) {
    return err.status >= 500 || err.status === 429 || err.status === 408 || err.status === 504;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Streaming — shared by /api/analyze and /api/chat
// ---------------------------------------------------------------------------

export class ChatApiError extends Error {
  public readonly status: number;
  /** Set when the stream had already forwarded tokens before failing. */
  public streamedPartial?: boolean;

  constructor(message: string, status: number, streamedPartial = false) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
    this.streamedPartial = streamedPartial;
  }
}

interface StreamCandidateArgs {
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  temperature?: number;
  /** Caller abort (request.signal). */
  signal?: AbortSignal;
  onToken: (delta: string) => void;
}

/**
 * Streams one candidate model's SSE deltas to `onToken` and resolves with
 * the fully assembled text. Budgets:
 *   - TTFB: must receive response HEADERS within streamTtfbTimeoutMs()
 *   - TOTAL: whole call (headers + body) within streamTotalTimeoutMs()
 * Throws ChatApiError; `streamedPartial` is true when onToken already ran,
 * so callers must NOT silently retry onto another model (the client would
 * see a duplicated prefix).
 */
export async function streamFromCandidate(
  args: StreamCandidateArgs,
): Promise<string> {
  const ttfbMs = streamTtfbTimeoutMs();
  const totalMs = streamTotalTimeoutMs();

  // One controller drives fetch AND the body reader; two tagged timers
  // distinguish a time-to-first-byte breach from an overall-budget breach.
  const controller = new AbortController();
  let ttfbFired = false;
  let totalFired = false;

  const ttfbTimer = setTimeout(() => {
    ttfbFired = true;
    controller.abort();
  }, ttfbMs);
  const totalTimer = setTimeout(() => {
    totalFired = true;
    controller.abort();
  }, totalMs);

  const onUserAbort = (): void => controller.abort();
  if (args.signal) {
    if (args.signal.aborted) controller.abort();
    else args.signal.addEventListener("abort", onUserAbort, { once: true });
  }

  let assembled = "";

  try {
    const upstream = await fetch(chatUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(
        buildRequestBody(
          {
            modelId: args.modelId,
            messages: args.messages as ChatMessage[],
            temperature: args.temperature,
            maxTokens: args.maxTokens,
          },
          true,
        ),
      ),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      throw new ChatApiError(
        `NVIDIA stream error (HTTP ${upstream.status}) for ${args.modelId}: ${text || "no body"}`,
        upstream.status,
      );
    }

    // Headers arrived — the TTFB budget is spent. Disarm it so it cannot
    // fire mid-body and masquerade as an abort before the total budget.
    clearTimeout(ttfbTimer);
    ttfbFired = false;

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
            // ignore malformed payloads from upstream
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return assembled;
  } catch (err) {
    const userAborted = args.signal?.aborted ?? false;
    if (!userAborted && totalFired) {
      throw new ChatApiError(
        `NVIDIA stream exceeded total budget ${totalMs}ms for ${args.modelId}`,
        504,
        assembled.length > 0,
      );
    }
    if (!userAborted && ttfbFired && assembled.length === 0) {
      throw new ChatApiError(
        `NVIDIA stream time-to-first-byte exceeded ${ttfbMs}ms for ${args.modelId}`,
        504,
      );
    }
    throw err;
  } finally {
    clearTimeout(ttfbTimer);
    clearTimeout(totalTimer);
    args.signal?.removeEventListener("abort", onUserAbort);
  }
}
