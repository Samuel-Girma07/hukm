/**
 * HUKM — Analysis API Route
 *
 * POST /api/analyze
 *
 * Two response modes:
 *   - Default JSON  → buffered request: 200 with { success, resultId, result, ... }.
 *   - NDJSON stream → triggered by `Accept: application/x-ndjson` header or
 *                     `?stream=1` in the URL. Emits, one event per line:
 *                       {"type":"status","phase":"retrieving"}
 *                       {"type":"chunks","chunks":[...]}
 *                       {"type":"status","phase":"drafting","model":"..."}
 *                       {"type":"delta","content":"..."}     (1..N times)
 *                       {"type":"done","resultId":"...","result":{...}}
 *                       {"type":"error","error":"..."}
 *                     The client can render progress + a live token feed
 *                     and then redirect to /results/[resultId] on `done`.
 *
 * Pipeline:
 *   1. Validate body
 *   2. Rate-limit check
 *   3. Retrieve relevant law chunks (embed + match_law_chunks RPC)
 *   4. Build the analysis system prompt
 *   5. Call NVIDIA (streaming SSE in stream-mode, buffered in JSON-mode)
 *   6. Parse the model output
 *   7. Persist to `analysis_results`
 *   8. Return resultId + result
 */

import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantChunks } from "@/lib/rag";
import { buildAnalysisPrompt } from "@/lib/systemPrompt";
import { callChatAPI } from "@/lib/nvidia";
import { CHAT_ENDPOINT } from "@/lib/models";
import { parseResponse } from "@/lib/parser";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rateLimit";
import { getSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { isValidModelId } from "@/lib/models";
import {
  AnalyzeRequest,
  AnalyzeResponse,
  LawChunk,
  AnalysisResult,
  AnalysisResultWithSources,
} from "@/lib/types";

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalyzeResponse> | Response> {
  try {
    // ---- A: Determine response mode ---------------------------------------
    const acceptHeader = request.headers.get("accept") ?? "";
    let streamFlag = false;
    try {
      streamFlag = new URL(request.url).searchParams.get("stream") === "1";
    } catch {
      // Synthetic NextRequest in tests doesn't have a parseable URL.
    }
    const wantsStream =
      streamFlag || acceptHeader.includes("application/x-ndjson");

    // ---- B: Parse and validate body ---------------------------------------
    const body = await request.json();
    const validationError = validateRequest(body);
    if (validationError) {
      return jsonError(validationError, body?.modelId, 400);
    }
    const scenarioInput = body as AnalyzeRequest;

    // ---- C: Rate limit ----------------------------------------------------
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    const rateLimitResult = await checkRateLimit(ip, scenarioInput.modelId);

    if (!rateLimitResult.allowed) {
      const isPremium = scenarioInput.modelId.startsWith("z-ai/");
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. You've reached the maximum number of requests for ${isPremium ? "premium models" : "fallback models"}. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
          modelId: scenarioInput.modelId,
          retrievedChunks: [],
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      );
    }

    if (wantsStream) {
      const stream = buildAnalyzeStream({
        scenarioInput,
        request,
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
    }

    // ---- D: Buffered (non-streaming) path --------------------------------
    const retrievedChunks = await retrieveSafe(scenarioInput.description);
    const systemPrompt = buildAnalysisPrompt(retrievedChunks);

    let result: AnalysisResult;
    logger.info(
      `[API] Calling NVIDIA chat API with model: ${scenarioInput.modelId}...`,
    );
    const chatStart = Date.now();
    try {
      result = await callChatAPI(scenarioInput, systemPrompt);
      logger.info(`[API] Chat API completed in ${Date.now() - chatStart}ms`);
    } catch (chatError) {
      logger.error("Chat API failed:", chatError);
      return jsonError(
        "Failed to generate analysis. Please try again.",
        scenarioInput.modelId,
        500,
      );
    }

    const persisted = await persistResult({
      scenarioInput,
      result,
      retrievedChunks,
    });

    if (!persisted.ok) {
      return jsonError(
        "Failed to save analysis result. Please try again.",
        scenarioInput.modelId,
        500,
      );
    }

    return NextResponse.json(
      {
        success: true,
        resultId: persisted.id,
        result,
        modelId: scenarioInput.modelId,
        retrievedChunks,
      },
      { headers: getRateLimitHeaders(rateLimitResult) },
    );
  } catch (error) {
    logger.error("Unexpected error in /api/analyze:", error);
    return jsonError(
      "An unexpected error occurred. Please try again.",
      "unknown",
      500,
    );
  }
}

// ============================================================================
// STREAMING IMPLEMENTATION
// ============================================================================

interface StreamArgs {
  scenarioInput: AnalyzeRequest;
  request: NextRequest;
}

function buildAnalyzeStream(args: StreamArgs): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (event: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        // 1. Retrieve law chunks
        write({ type: "status", phase: "retrieving" });
        const retrievedChunks = await retrieveSafe(
          args.scenarioInput.description,
        );
        write({
          type: "chunks",
          chunks: retrievedChunks.map((c) => ({
            id: c.id,
            documentName: c.documentName,
            articleReference: c.articleReference,
            similarity: c.similarity,
          })),
        });

        // 2. Build prompt + start the upstream NVIDIA streaming call.
        const systemPrompt = buildAnalysisPrompt(retrievedChunks);
        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) {
          write({ type: "error", error: "API configuration error" });
          close();
          return;
        }

        write({ type: "status", phase: "drafting", model: args.scenarioInput.modelId });

        const requestBody: {
          model: string;
          messages: { role: string; content: string }[];
          temperature: number;
          max_tokens: number;
          stream: boolean;
          chat_template_kwargs?: { enable_thinking: boolean };
        } = {
          model: args.scenarioInput.modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildUserMessage(args.scenarioInput) },
          ],
          temperature: 0.1,
          max_tokens: 2048,
          stream: true,
        };
        if (args.scenarioInput.modelId.startsWith("z-ai/")) {
          requestBody.chat_template_kwargs = { enable_thinking: false };
        }

        const upstream = await fetch(CHAT_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(requestBody),
          signal: args.request.signal,
        });

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "");
          logger.error(
            "NVIDIA API error (analyze stream):",
            upstream.status,
            errorText,
          );
          write({ type: "error", error: "AI service unavailable" });
          close();
          return;
        }

        if (!upstream.body) {
          write({ type: "error", error: "Empty upstream body" });
          close();
          return;
        }

        // 3. Pipe SSE deltas → NDJSON deltas; collect the full assistant
        //    text so we can JSON-parse it after the stream ends.
        const reader = upstream.body.getReader();
        let buffer = "";
        let assistantText = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

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
          close();
          return;
        }

        // 4. Parse and persist
        const result = parseResponse(assistantText);
        const persisted = await persistResult({
          scenarioInput: args.scenarioInput,
          result,
          retrievedChunks,
        });

        if (!persisted.ok) {
          write({
            type: "error",
            error: "Failed to save analysis result. Please try again.",
          });
          close();
          return;
        }

        write({
          type: "done",
          resultId: persisted.id,
          result,
        });
      } catch (err) {
        // Aborted by client — that's fine, just bail.
        if (err instanceof Error && err.name === "AbortError") {
          logger.info("[API] /api/analyze stream aborted by client");
        } else {
          logger.error("Streaming analyze handler crashed:", err);
          try {
            write({ type: "error", error: "Unexpected streaming error" });
          } catch {
            /* ignore */
          }
        }
      } finally {
        close();
      }
    },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

async function retrieveSafe(description: string): Promise<LawChunk[]> {
  const start = Date.now();
  logger.info("[API] Starting law retrieval for query...");
  try {
    const chunks = await retrieveRelevantChunks(description, 8);
    logger.info(
      `[API] Retrieved ${chunks.length} law chunks in ${Date.now() - start}ms`,
    );
    return chunks;
  } catch (err) {
    logger.error("Law retrieval failed:", err);
    return [];
  }
}

interface PersistArgs {
  scenarioInput: AnalyzeRequest;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
}

interface PersistOk {
  ok: true;
  id: string;
  resultWithSources: AnalysisResultWithSources;
}
interface PersistFail {
  ok: false;
}

async function persistResult(
  args: PersistArgs,
): Promise<PersistOk | PersistFail> {
  const sessionId = await getSessionId();
  const supabase = getServerClient();
  const resultWithSources: AnalysisResultWithSources = {
    ...args.result,
    retrievedChunks: args.retrievedChunks,
  };
  const { data, error } = await supabase
    .from("analysis_results")
    .insert({
      session_id: sessionId,
      scenario_input: args.scenarioInput,
      result: resultWithSources,
      model_id: args.scenarioInput.modelId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    logger.error("Failed to persist analysis result:", error);
    return { ok: false };
  }
  return { ok: true, id: data.id as string, resultWithSources };
}

function jsonError(
  error: string,
  modelId: string | undefined,
  status: number,
): NextResponse<AnalyzeResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      modelId: modelId ?? "unknown",
      retrievedChunks: [],
    },
    { status },
  );
}

function buildUserMessage(input: AnalyzeRequest): string {
  // Mirror lib/nvidia.ts's buildUserMessage so analyze-stream and the
  // buffered path produce comparable responses.
  const lines: string[] = [];
  lines.push("## SCENARIO DESCRIPTION", "", input.description, "");
  lines.push(
    "## RESPONSE LANGUAGE",
    "",
    `Respond in: ${input.language === "amharic" ? "Amharic" : "English"}`,
    "",
  );
  if (input.crimeCategory) {
    lines.push("## CRIME CATEGORY", "", `Category: ${input.crimeCategory}`, "");
  }
  const sliders: string[] = [];
  if (typeof input.severity === "number") {
    sliders.push(`- Severity: ${input.severity}/10`);
  }
  if (typeof input.intent === "number") {
    sliders.push(`- Intent: ${input.intent}/10`);
  }
  if (typeof input.history === "number") {
    sliders.push(`- Prior History: ${input.history}/10`);
  }
  if (sliders.length > 0) {
    lines.push("## ASSESSMENT FACTORS", "", ...sliders, "");
  }
  lines.push(
    "## INSTRUCTION",
    "",
    "Analyze this scenario according to Ethiopian criminal law. Provide your response in valid JSON format only, following the AnalysisResult schema.",
  );
  return lines.join("\n");
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(body: Record<string, unknown>): string | null {
  if (!body) return "Request body is required";

  if (!body.description) return "Description is required";
  if (typeof body.description !== "string") {
    return "Description must be a string";
  }
  if (body.description.length < 10) {
    return "Description must be at least 10 characters";
  }
  if (body.description.length > 5000) {
    return "Description must not exceed 5000 characters";
  }

  if (!body.modelId) return "Model ID is required";
  if (typeof body.modelId !== "string") return "Model ID must be a string";
  if (!isValidModelId(body.modelId as string)) return "Invalid model ID";

  if (
    body.language &&
    typeof body.language === "string" &&
    !["english", "amharic"].includes(body.language)
  ) {
    return 'Language must be either "english" or "amharic"';
  }

  const sliderFields = ["severity", "intent", "history"] as const;
  for (const field of sliderFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "number") return `${field} must be a number`;
      if ((body[field] as number) < 1 || (body[field] as number) > 10) {
        return `${field} must be between 1 and 10`;
      }
    }
  }

  return null;
}
