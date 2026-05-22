/**
 * HUKM — Chat API Endpoint
 *
 * POST /api/chat
 *
 * Handles multi-turn conversations with context persistence.
 *
 * Two response modes:
 *   - Default JSON: returns the full assistant message in one response.
 *   - NDJSON streaming: returns an `application/x-ndjson` stream of
 *     {"type":"delta","content":"..."} chunks followed by a final
 *     {"type":"done", ...} event. Triggered by Accept header containing
 *     "application/x-ndjson" or by `?stream=1` in the URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { CHAT_ENDPOINT, isValidModelId } from "@/lib/models";
import { retrieveRelevantChunks } from "@/lib/rag";
import { buildChatPrompt } from "@/lib/systemPrompt";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rateLimit";
import { getServerClient } from "@/lib/supabase";
import { assertOwnsConversation, OwnershipError } from "@/lib/ownership";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LawChunk } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  conversationId: string;
  message: string;
  modelId: string;
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const acceptHeader = request.headers.get("accept") ?? "";
    let streamFlag = false;
    try {
      streamFlag = new URL(request.url).searchParams.get("stream") === "1";
    } catch {
      // Tests pass synthetic NextRequest objects without a real URL; fall back
      // to the Accept-header signal.
    }
    const wantsStream =
      streamFlag || acceptHeader.includes("application/x-ndjson");

    const body = await request.json();
    const validationError = validateRequest(body);
    if (validationError) {
      return errorJson(validationError, 400);
    }

    const chatRequest = body as ChatRequest;

    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    const rateLimitResult = await checkRateLimit(ip, chatRequest.modelId);
    if (!rateLimitResult.allowed) {
      const isPremium = chatRequest.modelId.startsWith("z-ai/");
      return NextResponse.json(
        {
          success: false,
          conversationId: chatRequest.conversationId || "",
          messageId: "",
          response: "",
          error: `Rate limit exceeded for ${isPremium ? "premium models" : "fallback models"}. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      );
    }

    const sessionId = await getSessionId();

    let supabase: SupabaseClient;
    try {
      supabase = getServerClient();
    } catch (envError) {
      logger.error("Supabase env validation failed:", envError);
      return errorJson("Database configuration error", 500, {
        conversationId: chatRequest.conversationId,
      });
    }

    // ---- Verify the caller owns this conversation -----------------------
    // /api/chat NO LONGER auto-creates conversations. Callers must first
    // POST /api/conversations (with a resultId or modelId) and pass the
    // resulting id here. This stops the previous behaviour where every
    // missing conversationId minted an "(empty scenario)" placeholder
    // that polluted the user's history.
    const conversationId = chatRequest.conversationId;
    try {
      await assertOwnsConversation(supabase, conversationId, sessionId);
    } catch (err) {
      if (err instanceof OwnershipError) {
        return errorJson(err.message, err.status, { conversationId });
      }
      throw err;
    }

    // ---- Save user message ----------------------------------------------
    const { error: userMsgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: chatRequest.message,
      })
      .select()
      .single();

    if (userMsgError) {
      logger.error("Failed to save user message:", userMsgError);
      return errorJson("Failed to save message", 500, {
        conversationId,
      });
    }

    // ---- Build conversation history -------------------------------------
    const { data: messages, error: msgError } = await supabase.rpc(
      "get_conversation_messages",
      { p_conversation_id: conversationId },
    );
    if (msgError) {
      logger.error("Failed to load conversation history:", msgError);
    }

    const retrievedChunks = await retrieveRelevantChunks(
      chatRequest.message,
      8,
    );

    // Build a CONVERSATIONAL system prompt — distinct from the JSON-only
    // one used by /api/analyze. Re-using the analysis prompt here forced
    // every follow-up reply to be a 7-step JSON dump; this returns the
    // chat to its intended free-form behaviour.
    const systemPrompt = buildChatPrompt(retrievedChunks);

    const conversationHistory: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];
    const recentMessages = messages?.slice(-20) || [];
    for (const msg of recentMessages) {
      conversationHistory.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // ---- Call NVIDIA ----------------------------------------------------
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return errorJson("API configuration error", 500, { conversationId });
    }

    const requestBody: {
      model: string;
      messages: ChatMessage[];
      temperature: number;
      max_tokens: number;
      stream: boolean;
      chat_template_kwargs?: { enable_thinking: boolean };
    } = {
      model: chatRequest.modelId,
      messages: conversationHistory,
      temperature: 0.1,
      max_tokens: 2048,
      stream: wantsStream,
    };

    if (chatRequest.modelId.startsWith("z-ai/")) {
      requestBody.chat_template_kwargs = { enable_thinking: false };
    }

    const upstream = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: wantsStream ? "text/event-stream" : "application/json",
      },
      body: JSON.stringify(requestBody),
      // Cancel the upstream call as soon as the client disconnects so we
      // don't burn NVIDIA tokens on a response no one will read.
      signal: request.signal,
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      logger.error("NVIDIA API error:", upstream.status, errorText);
      return errorJson("AI service unavailable", 502, { conversationId });
    }

    if (!wantsStream) {
      // ---- Non-streaming path (back-compat) -----------------------------
      const data = await upstream.json();
      const aiResponse = data.choices?.[0]?.message?.content || "";
      if (!aiResponse) {
        return errorJson("Empty response from AI", 500, { conversationId });
      }

      const { data: assistantMessage, error: assistantMsgError } =
        await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            role: "assistant",
            content: aiResponse,
            metadata: {
              model: chatRequest.modelId,
            },
          })
          .select()
          .single();

      if (assistantMsgError) {
        logger.error("Failed to save assistant message:", assistantMsgError);
      }

      return NextResponse.json(
        {
          success: true,
          conversationId: conversationId || "",
          messageId: assistantMessage?.id || "",
          response: aiResponse,
          retrievedChunks: serializeChunks(retrievedChunks),
        },
        { headers: getRateLimitHeaders(rateLimitResult) },
      );
    }

    // ---- Streaming path ---------------------------------------------------
    const stream = buildNdjsonStream({
      upstream,
      supabase,
      conversationId,
      modelId: chatRequest.modelId,
      retrievedChunks,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        ...getRateLimitHeaders(rateLimitResult),
      },
    });
  } catch (error) {
    logger.error("Unexpected error in /api/chat:", error);
    return errorJson("An unexpected error occurred", 500);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function errorJson(
  message: string,
  status: number,
  extras: { conversationId?: string } = {},
) {
  return NextResponse.json(
    {
      success: false,
      conversationId: extras.conversationId ?? "",
      messageId: "",
      response: "",
      error: message,
    },
    { status },
  );
}

function serializeChunks(chunks: LawChunk[]) {
  return chunks.map((chunk) => ({
    id: chunk.id,
    documentName: chunk.documentName,
    articleReference: chunk.articleReference,
    content: chunk.content,
    similarity: chunk.similarity,
  }));
}

function validateRequest(body: Record<string, unknown>): string | null {
  if (!body) return "Request body is required";
  if (!body.message || typeof body.message !== "string") {
    return "Message is required";
  }
  if (body.message.trim().length === 0) return "Message cannot be empty";
  if (body.message.length > 5000) {
    return "Message too long (max 5000 characters)";
  }
  if (!body.modelId || typeof body.modelId !== "string") {
    return "Model ID is required";
  }
  if (!isValidModelId(body.modelId as string)) return "Invalid model ID";
  if (!body.conversationId || typeof body.conversationId !== "string") {
    return "Conversation ID is required \u2014 create a conversation first via POST /api/conversations";
  }
  return null;
}

// ============================================================================
// NDJSON STREAM ADAPTER
// ============================================================================

interface StreamArgs {
  upstream: Response;
  supabase: SupabaseClient;
  conversationId: string;
  modelId: string;
  retrievedChunks: LawChunk[];
}

function buildNdjsonStream(args: StreamArgs): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const write = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      let assistantText = "";

      try {
        if (!args.upstream.body) {
          write({ type: "error", error: "Empty upstream body" });
          controller.close();
          return;
        }

        const reader = args.upstream.body.getReader();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // NVIDIA streams SSE: each event is one or more
          // "data: {...}\n" lines, terminated by a blank line.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice("data:".length).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                assistantText += delta;
                write({ type: "delta", content: delta });
              }
            } catch (err) {
              logger.warn("Failed to parse SSE chunk:", err, payload);
            }
          }
        }

        if (!assistantText) {
          write({ type: "error", error: "Empty response from AI" });
          controller.close();
          return;
        }

        const { data: assistantMessage, error: assistantMsgError } =
          await args.supabase
            .from("messages")
            .insert({
              conversation_id: args.conversationId,
              role: "assistant",
              content: assistantText,
              metadata: {
                model: args.modelId,
              },
            })
            .select()
            .single();

        if (assistantMsgError) {
          logger.error(
            "Failed to save streamed assistant message:",
            assistantMsgError,
          );
        }

        write({
          type: "done",
          conversationId: args.conversationId,
          messageId: assistantMessage?.id ?? "",
          retrievedChunks: serializeChunks(args.retrievedChunks),
        });
      } catch (err) {
        logger.error("Streaming chat handler crashed:", err);
        try {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: "Unexpected streaming error",
              }) + "\n",
            ),
          );
        } catch {
          /* ignore */
        }
      } finally {
        controller.close();
      }
    },
  });
}
