/**
 * POST /api/analyze
 *
 * Buffered or streaming, depending on whether `?stream=true` is in the URL.
 *
 * Pipeline (buffered):
 *   1. Validate body (length, modelId, optional category, optional sliders)
 *   2. Rate-limit
 *   3. Analysis-cache check  → cache HIT short-circuits the whole pipeline
 *   4. RAG retrieval (with embedding cache)
 *   5. Compute deterministic confidence from retrieval stats
 *   6. Build prompt and call NVIDIA chat (with model fallback)
 *   7. Parse with the safe parser
 *   8. Override parser confidence with computed confidence
 *   9. Persist to analysis_results
 *   10. Cache the analysis pointer, log article accesses, fire usage event
 *   11. Return { resultId, result, retrievedChunks, retrieval, cache }
 *
 * Streaming variant: instead of step 6 + step 7 buffered, we forward
 * NVIDIA SSE deltas to the client as `{ type: "token", content }`
 * events. After the upstream stream ends we run the parser, override
 * confidence, persist, and emit one final `{ type: "done", … }` event
 * followed by `[DONE]`.
 */

import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/http";
import { logger, requestLogger } from "@/lib/logger";
import { ensureMigrationProbed } from "@/lib/migrationCheck";
import { trackEvent } from "@/lib/analytics";
import { isValidCrimeCategory } from "@/lib/crimeCategories";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/cache/analysisCache";
import { hashScenario, hashSession } from "@/lib/hash";
import { isValidModelId, CHAT_ENDPOINT, getFallbackChain, getModelThinkingConfig } from "@/lib/models";
import { computeConfidence, type ConfidenceAssessment } from "@/lib/confidence";
import { callChatWithFallback, ChatApiError } from "@/lib/nvidia";
import { parseAnalysisResponse } from "@/lib/parser";
import { buildAnalysisPrompt } from "@/lib/prompts";
import {
  checkRateLimit,
  identifyClient,
  rateLimitHeaders,
} from "@/lib/ratelimit";
import { retrieveContext } from "@/lib/retrieval";
import {
  setRequestContext,
  addBreadcrumb,
  captureException,
} from "@/lib/sentry";
import { getOrCreateSessionId } from "@/lib/session";
import { encodeSSE } from "@/lib/streaming";
import { getServerClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { nanoid } from "nanoid";
import type {
  AnalyzeResponse,
  AnalysisResult,
  CrimeCategory,
  Language,
  LawChunk,
  RetrievalResult,
  ScenarioContext,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SCENARIO_MIN_LENGTH = 10;
const SCENARIO_MAX_LENGTH = 5000;

interface ValidatedBody {
  scenario: string;
  modelId: string;
  language: Language;
  crimeCategory?: CrimeCategory;
  scenarioContext?: ScenarioContext;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateContext(raw: unknown): ScenarioContext | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObject(raw)) return "`scenarioContext` must be an object.";
  const out: ScenarioContext = {};
  for (const axis of ["severity", "intent", "history"] as const) {
    const v = raw[axis];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return `\`scenarioContext.${axis}\` must be a number 1..5.`;
    }
    if (v < 1 || v > 5) return `\`scenarioContext.${axis}\` must be between 1 and 5.`;
    out[axis] = Math.round(v);
  }
  return out;
}

function validateBody(raw: unknown): ValidatedBody | string {
  if (!isObject(raw)) return "Request body must be a JSON object.";
  const body = raw;

  const scenario = body.scenario;
  if (typeof scenario !== "string") return "`scenario` must be a string.";
  const trimmed = scenario.trim();
  if (trimmed.length < SCENARIO_MIN_LENGTH) {
    return `\`scenario\` must be at least ${SCENARIO_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > SCENARIO_MAX_LENGTH) {
    return `\`scenario\` must not exceed ${SCENARIO_MAX_LENGTH} characters.`;
  }

  const modelId = body.modelId;
  if (typeof modelId !== "string" || modelId.trim().length === 0) {
    return "`modelId` is required.";
  }
  if (!isValidModelId(modelId)) {
    return "`modelId` is not registered.";
  }

  let language: Language = "en";
  if (body.language !== undefined) {
    if (body.language === "en" || body.language === "am") {
      language = body.language;
    } else {
      return "`language` must be either 'en' or 'am'.";
    }
  }

  let crimeCategory: CrimeCategory | undefined;
  if (body.crimeCategory !== undefined && body.crimeCategory !== null) {
    if (typeof body.crimeCategory !== "string" || !isValidCrimeCategory(body.crimeCategory)) {
      return "`crimeCategory` is not a recognised category.";
    }
    crimeCategory = body.crimeCategory;
  }

  const ctx = validateContext(body.scenarioContext);
  if (typeof ctx === "string") return ctx;

  return {
    scenario: trimmed,
    modelId,
    language,
    crimeCategory,
    scenarioContext: ctx,
  };
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface PersistArgs {
  sessionId: string;
  scenario: string;
  modelId: string;
  language: Language;
  crimeCategory?: CrimeCategory;
  scenarioContext?: ScenarioContext;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  retrieval: RetrievalResult;
  computedConfidence: ConfidenceAssessment;
}

async function persistAnalysis(args: PersistArgs): Promise<string | null> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("analysis_results")
    .insert({
      session_id: args.sessionId,
      scenario_input: {
        scenario: args.scenario,
        modelId: args.modelId,
        language: args.language,
        crimeCategory: args.crimeCategory,
        scenarioContext: args.scenarioContext,
      },
      result: {
        ...args.result,
        retrievedChunks: args.retrievedChunks,
        retrieval: args.retrieval,
      },
      model_id: args.modelId,
      // Store retrieval stats for future calibration
      retrieval_stats: args.computedConfidence.stats,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    logger.error("[analyze] failed to persist analysis_results", {
      error: error?.message,
      code: error?.code,
    });
    return null;
  }
  return data.id as string;
}

async function logArticleAccesses(
  analysisId: string,
  chunks: LawChunk[],
): Promise<void> {
  if (chunks.length === 0) return;
  try {
    const supabase = getServerClient();
    await supabase.from("article_access_log").insert(
      chunks.map((chunk) => ({
        article_reference: chunk.article_reference,
        document_name: chunk.document_name,
        analysis_id: analysisId,
        similarity: chunk.similarity,
      })),
    );
  } catch (err) {
    logger.debug("[analyze] article_access_log insert failed (ignored)", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Overrides the LLM's confidence with the pre-computed deterministic value.
 * Preserves the LLM's confidenceReason if it expanded on the pre-computed one,
 * otherwise uses the computed reason.
 */
function applyComputedConfidence(
  parsed: AnalysisResult,
  assessment: ConfidenceAssessment,
): AnalysisResult {
  // If the LLM's reason is just the placeholder or missing, use the computed one
  const reasonIsPlaceholder =
    !parsed.confidenceReason ||
    parsed.confidenceReason === "Confidence reason was not provided in the model response." ||
    parsed.confidenceReason.includes("pre-computed");

  return {
    ...parsed,
    confidenceLevel: assessment.level,
    confidenceReason: reasonIsPlaceholder
      ? assessment.reason
      : `${assessment.reason} (LLM notes: ${parsed.confidenceReason})`,
  };
}

// ---------------------------------------------------------------------------
// Buffered handler
// ---------------------------------------------------------------------------

interface RunPipelineSuccess {
  ok: true;
  resultId: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  retrieval: RetrievalResult;
  modelIdActual: string;
  cache: boolean;
}

interface RunPipelineFail {
  ok: false;
  status: number;
  error: string;
  code: string;
}

async function runPipelineBuffered(
  body: ValidatedBody,
  sessionId: string,
): Promise<RunPipelineSuccess | RunPipelineFail> {
  const requestId = nanoid(10);
  const reqLog = requestLogger({
    requestId,
    endpoint: "/api/analyze",
    sessionIdHash: hashSession(sessionId),
    modelId: body.modelId,
    inputLength: body.scenario.length,
  });

  // Cache check.
  const scenarioHash = hashScenario(body.scenario);
  const cached = await getCachedAnalysis(scenarioHash);
  if (cached) {
    reqLog.info({ cacheHit: true, resultId: cached.resultId }, "analysis cache hit");
    const r = cached.analysis.result;
    const result: AnalysisResult = {
      step1FactIdentification: r.step1FactIdentification,
      step2LegalClassification: r.step2LegalClassification,
      step3ElementsAnalysis: r.step3ElementsAnalysis,
      step4DefensesAndMitigation: r.step4DefensesAndMitigation,
      step5SentencingFramework: r.step5SentencingFramework,
      step6PrecedentApplication: r.step6PrecedentApplication,
      step7Conclusion: r.step7Conclusion,
      estimatedPunishment: r.estimatedPunishment,
      confidenceLevel: r.confidenceLevel,
      confidenceReason: r.confidenceReason,
      proceduralRoadmap: r.proceduralRoadmap,
      disclaimer: r.disclaimer,
      isCivilMatter: r.isCivilMatter,
      civilExplanation: r.civilExplanation,
      needsClarification: r.needsClarification,
      clarifyingQuestions: r.clarifyingQuestions,
      suggestedFollowUps: r.suggestedFollowUps,
      detectedCrimeCategory: r.detectedCrimeCategory,
      rawResponse: r.rawResponse,
    };
    const chunks = r.retrievedChunks ?? [];
    const retrieval: RetrievalResult = r.retrieval ?? {
      chunks,
      stage: 1,
      maxSimilarity: chunks.reduce(
        (m, c) => (c.similarity > m ? c.similarity : m),
        0,
      ),
    };
    trackEvent({
      eventType: "analyze",
      sessionId,
      modelId: cached.analysis.model_id,
      crimeCategory: body.crimeCategory ?? null,
      confidenceLevel: result.confidenceLevel,
      language: body.language,
      metadata: { cache: true, requestId },
    });
    void logArticleAccesses(cached.resultId, chunks);
    return {
      ok: true,
      resultId: cached.resultId,
      result,
      retrievedChunks: chunks,
      retrieval,
      modelIdActual: cached.analysis.model_id,
      cache: true,
    };
  }

  // RAG retrieval.
  const retrievalStart = Date.now();
  const retrieval = await retrieveContext(body.scenario);
  reqLog.info(
    {
      retrievalStage: retrieval.stage,
      chunksRetrieved: retrieval.chunks.length,
      maxSimilarity: retrieval.maxSimilarity,
      embeddingCacheHit: retrieval.embeddingCacheHit,
      durationMs: Date.now() - retrievalStart,
    },
    "retrieval complete",
  );

  // Compute deterministic confidence.
  const confidenceAssessment = computeConfidence(retrieval);
  reqLog.info(
    {
      computedConfidence: confidenceAssessment.level,
      strongMatches: confidenceAssessment.stats.strongCount,
      hasPunishment: confidenceAssessment.stats.hasPunishment,
      hasCriminalCode: confidenceAssessment.stats.hasCriminalCode,
    },
    "confidence computed",
  );

  // Build prompts.
  const systemPrompt = buildAnalysisPrompt({
    retrieval,
    language: body.language,
    crimeCategory: body.crimeCategory,
    scenarioContext: body.scenarioContext,
    computedConfidence: confidenceAssessment,
  });
  const userMessage = buildUserMessage(body);

  // Call NVIDIA.
  const chatStart = Date.now();
  let assistantContent: string;
  let actualModelId: string;
  try {
    const result = await callChatWithFallback({
      modelId: body.modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    assistantContent = result.content;
    actualModelId = result.modelId;
  } catch (err) {
    captureException(err, { endpoint: "/api/analyze" });
    reqLog.error({ err }, "NVIDIA chat failed across fallback chain");
    return {
      ok: false,
      status: 503,
      error: "The AI service is currently unavailable. Please try again in a moment.",
      code: "AI_UPSTREAM",
    };
  }
  reqLog.info(
    {
      requestedModel: body.modelId,
      actualModel: actualModelId,
      durationMs: Date.now() - chatStart,
      contentChars: assistantContent.length,
    },
    "chat call complete",
  );

  // Parse.
  let parsed = parseAnalysisResponse(assistantContent);
  
  // Override with deterministic confidence.
  parsed = applyComputedConfidence(parsed, confidenceAssessment);
  
  reqLog.info(
    {
      parseSuccess: parsed.confidenceLevel !== "NEEDS_REVIEW",
      confidenceLevel: parsed.confidenceLevel,
      isCivilMatter: parsed.isCivilMatter,
      needsClarification: parsed.needsClarification,
      followUps: parsed.suggestedFollowUps?.length ?? 0,
    },
    "parse complete",
  );

  // Persist.
  const resultId = await persistAnalysis({
    sessionId,
    scenario: body.scenario,
    modelId: actualModelId,
    language: body.language,
    crimeCategory: body.crimeCategory,
    scenarioContext: body.scenarioContext,
    result: parsed,
    retrievedChunks: retrieval.chunks,
    retrieval,
    computedConfidence: confidenceAssessment,
  });

  if (!resultId) {
    return {
      ok: false,
      status: 500,
      error: "Analysis was generated but could not be saved. Please try again.",
      code: "PERSIST_FAILED",
    };
  }

  // Background work.
  void setCachedAnalysis(scenarioHash, resultId);
  void logArticleAccesses(resultId, retrieval.chunks);
  trackEvent({
    eventType: "analyze",
    sessionId,
    modelId: actualModelId,
    crimeCategory: body.crimeCategory ?? null,
    confidenceLevel: parsed.confidenceLevel,
    language: body.language,
    metadata: {
      cache: false,
      retrievalStage: retrieval.stage,
      chunksRetrieved: retrieval.chunks.length,
      embeddingCacheHit: retrieval.embeddingCacheHit,
      requestId,
    },
  });

  return {
    ok: true,
    resultId,
    result: parsed,
    retrievedChunks: retrieval.chunks,
    retrieval,
    modelIdActual: actualModelId,
    cache: false,
  };
}

// ---------------------------------------------------------------------------
// Streaming handler
// ---------------------------------------------------------------------------

interface StreamArgs {
  body: ValidatedBody;
  sessionId: string;
  request: NextRequest;
}

function buildStreamingResponse(args: StreamArgs): ReadableStream<Uint8Array> {
  const { body, sessionId, request } = args;
  const requestId = nanoid(10);
  const reqLog = requestLogger({
    requestId,
    endpoint: "/api/analyze#stream",
    sessionIdHash: hashSession(sessionId),
    modelId: body.modelId,
    inputLength: body.scenario.length,
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const enqueue = (event: Parameters<typeof encodeSSE>[0]): void => {
        if (closed) return;
        try {
          controller.enqueue(encodeSSE(event));
        } catch {
          // controller may have been aborted by the client
        }
      };
      const closeStream = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        // Cache check.
        const scenarioHash = hashScenario(body.scenario);
        const cached = await getCachedAnalysis(scenarioHash);
        if (cached) {
          reqLog.info({ cacheHit: true, resultId: cached.resultId }, "analysis cache hit");
          const r = cached.analysis.result;
          const fullText = JSON.stringify(r);
          // Emit the cached JSON in one token to keep the StreamingText
          // client component consistent.
          enqueue({ type: "token", content: fullText });
          enqueue({
            type: "done",
            resultId: cached.resultId,
            result: r,
            retrievedChunks: r.retrievedChunks ?? [],
            cache: true,
            retrieval: r.retrieval,
          });
          enqueue("DONE");
          closeStream();
          trackEvent({
            eventType: "analyze",
            sessionId,
            modelId: cached.analysis.model_id,
            crimeCategory: body.crimeCategory ?? null,
            confidenceLevel: r.confidenceLevel,
            language: body.language,
            metadata: { cache: true, stream: true, requestId },
          });
          void logArticleAccesses(cached.resultId, r.retrievedChunks ?? []);
          return;
        }

        // RAG retrieval.
        enqueue({ type: "phase", phase: "retrieving" });
        const retrieval = await retrieveContext(body.scenario);
        reqLog.info(
          {
            retrievalStage: retrieval.stage,
            chunksRetrieved: retrieval.chunks.length,
            maxSimilarity: retrieval.maxSimilarity,
          },
          "retrieval complete (stream)",
        );

        // Compute deterministic confidence.
        const confidenceAssessment = computeConfidence(retrieval);

        const systemPrompt = buildAnalysisPrompt({
          retrieval,
          language: body.language,
          crimeCategory: body.crimeCategory,
          scenarioContext: body.scenarioContext,
          computedConfidence: confidenceAssessment,
        });
        const userMessage = buildUserMessage(body);

        // LLM phase begins.
        enqueue({ type: "phase", phase: "analyzing" });

        // Walk the model fallback chain manually so we can stream.
        const chain = getFallbackChain(body.modelId);
        let assistantText = "";
        let actualModelId: string | null = null;
        let lastUpstreamError: ChatApiError | null = null;

        for (const candidate of chain) {
          try {
            assistantText = await streamFromCandidate({
              modelId: candidate,
              systemPrompt,
              userMessage,
              signal: request.signal,
              onToken: (delta) => {
                if (delta.length === 0) return;
                enqueue({ type: "token", content: delta });
              },
            });
            actualModelId = candidate;
            if (candidate !== body.modelId) {
              addBreadcrumb("nvidia", "primary failed; fallback succeeded", {
                requested: body.modelId,
                actual: candidate,
              });
            }
            break;
          } catch (err) {
            if (err instanceof ChatApiError) {
              if (err.status >= 500 || err.status === 429 || err.status === 408) {
                lastUpstreamError = err;
                reqLog.warn({ candidate, status: err.status }, "candidate failed; trying next");
                continue;
              }
              lastUpstreamError = err;
              break;
            }
            throw err;
          }
        }

        if (!actualModelId || assistantText.trim().length === 0) {
          captureException(lastUpstreamError ?? new Error("All models failed"), {
            endpoint: "/api/analyze",
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

        // Parse.
        let parsed = parseAnalysisResponse(assistantText);
        
        // Override with deterministic confidence.
        parsed = applyComputedConfidence(parsed, confidenceAssessment);

        // Persist.
        enqueue({ type: "phase", phase: "persisting" });
        const resultId = await persistAnalysis({
          sessionId,
          scenario: body.scenario,
          modelId: actualModelId,
          language: body.language,
          crimeCategory: body.crimeCategory,
          scenarioContext: body.scenarioContext,
          result: parsed,
          retrievedChunks: retrieval.chunks,
          retrieval,
          computedConfidence: confidenceAssessment,
        });

        if (!resultId) {
          enqueue({
            type: "error",
            error: "Analysis was generated but could not be saved. Please try again.",
            code: "PERSIST_FAILED",
          });
          enqueue("DONE");
          closeStream();
          return;
        }

        void setCachedAnalysis(scenarioHash, resultId);
        void logArticleAccesses(resultId, retrieval.chunks);
        trackEvent({
          eventType: "analyze",
          sessionId,
          modelId: actualModelId,
          crimeCategory: body.crimeCategory ?? null,
          confidenceLevel: parsed.confidenceLevel,
          language: body.language,
          metadata: {
            cache: false,
            stream: true,
            retrievalStage: retrieval.stage,
            requestId,
          },
        });

        enqueue({
          type: "done",
          resultId,
          result: parsed,
          retrievedChunks: retrieval.chunks,
          retrieval,
          cache: false,
        });
        enqueue("DONE");
        closeStream();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          reqLog.info("client aborted stream");
        } else {
          captureException(err, { endpoint: "/api/analyze" });
          reqLog.error({ err }, "streaming handler crashed");
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
}

interface StreamCandidateArgs {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  signal: AbortSignal;
  onToken: (delta: string) => void;
}

interface ChatRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  stream: boolean;
  chat_template_kwargs?: { enable_thinking: boolean };
}

async function streamFromCandidate(args: StreamCandidateArgs): Promise<string> {
  const body: ChatRequestBody = {
    model: args.modelId,
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userMessage },
    ],
    temperature: 0.1,
    max_tokens: 2048,
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
          // ignore malformed payloads from upstream
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return assembled;
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

function buildUserMessage(body: ValidatedBody): string {
  const langLabel = body.language === "am" ? "Amharic" : "English";
  return [
    "## SCENARIO",
    "",
    body.scenario,
    "",
    "## INSTRUCTION",
    "",
    `Analyse this scenario under Ethiopian criminal law. Reply only with the strict JSON object specified by the system prompt, optionally followed by a single SUGGESTIONS line. Respond in ${langLabel}.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalyzeResponse> | Response> {
  // Probe schema once per process; non-blocking warning if v2 migration
  // hasn't been applied. Affected features degrade gracefully.
  ensureMigrationProbed();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON in request body.", "BAD_JSON");
  }

  const validation = validateBody(raw);
  if (typeof validation === "string") {
    return jsonError(400, validation, "VALIDATION");
  }
  const body = validation;

  let sessionId: string | null;
  sessionId = await getOrCreateSessionId();
  if (!sessionId) {
    return jsonError(401, "Authentication required.", "UNAUTHORIZED");
  }

  const rateLimit = await checkRateLimit(sessionId, body.modelId);
  if (!rateLimit.allowed) {
    return jsonError(
      429,
      `Rate limit exceeded for model ${body.modelId}. Retry after ${rateLimit.retryAfterSeconds} seconds.`,
      "RATE_LIMIT",
      rateLimitHeaders(rateLimit),
    );
  }

  setRequestContext({
    endpoint: "/api/analyze",
    modelId: body.modelId,
    sessionId,
  });

  const wantsStream =
    new URL(request.url).searchParams.get("stream") === "true";

  if (wantsStream) {
    const stream = buildStreamingResponse({ body, sessionId, request });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        ...rateLimitHeaders(rateLimit),
      },
    });
  }

  const result = await runPipelineBuffered(body, sessionId);
  if (!result.ok) {
    return jsonError(result.status, result.error, result.code);
  }

  return NextResponse.json(
    {
      success: true,
      resultId: result.resultId,
      result: result.result,
      modelId: result.modelIdActual,
      retrievedChunks: result.retrievedChunks,
      retrieval: result.retrieval,
      cache: result.cache,
    },
    {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "X-Cache": result.cache ? "HIT" : "MISS",
      },
    },
  );
}
