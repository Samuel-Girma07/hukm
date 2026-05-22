/**
 * Integration tests for POST /api/analyze.
 *
 * NVIDIA, Supabase, and session helpers are stubbed at module level so the
 * route handler can be exercised without network or database access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/session", () => ({
  getSessionId: vi.fn(async () => "test-session-id"),
}));

const insertSelectSingle = vi.fn(async () => ({
  data: { id: "result-uuid-123" },
  error: null,
}));

const fromMock = vi.fn(() => ({
  insert: () => ({
    select: () => ({
      single: insertSelectSingle,
    }),
  }),
}));

vi.mock("@/lib/supabase", () => ({
  getServerClient: () => ({
    from: fromMock,
  }),
}));

vi.mock("@/lib/rag", () => ({
  retrieveRelevantChunks: vi.fn(async () => [
    {
      id: 1,
      documentName: "criminal-code-414-2004",
      articleReference: "Article 525",
      content: "Sample retrieved law text.",
      metadata: {},
      similarity: 0.82,
    },
  ]),
}));

const callChatAPI = vi.fn(async () => ({
  step1FactIdentification: "Facts",
  step2LegalClassification: "Class",
  step3ElementsAnalysis: "Elements",
  step4DefensesAndMitigation: "Defenses",
  step5SentencingFramework: "Framework",
  step6PrecedentApplication: "Precedents",
  step7Conclusion: "Conclusion",
  estimatedPunishment: "Fine",
  confidenceLevel: "MEDIUM" as const,
  confidenceReason: "Reason",
  proceduralRoadmap: "Roadmap",
  disclaimer: "Disclaimer",
  isCivilMatter: false,
  needsClarification: false,
  rawResponse: "raw",
}));

vi.mock("@/lib/nvidia", () => ({
  callChatAPI: (...args: unknown[]) => callChatAPI(...args),
}));

import { POST } from "@/app/api/analyze/route";
import { NextRequest } from "next/server";

function buildRequest(body: unknown, ip = "127.0.0.1"): NextRequest {
  return {
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "x-forwarded-for" ? ip : null,
    },
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    callChatAPI.mockClear();
    insertSelectSingle.mockClear();
    fromMock.mockClear();
    insertSelectSingle.mockImplementation(async () => ({
      data: { id: "result-uuid-123" },
      error: null,
    }));
  });

  it("returns 400 when description is missing", async () => {
    const res = await POST(
      buildRequest({ modelId: "z-ai/glm4.7" }, "ip-missing-desc"),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Description/i);
  });

  it("returns 400 when modelId is invalid for missing field", async () => {
    const res = await POST(
      buildRequest(
        {
          description: "A short description over ten chars",
        },
        "ip-missing-model",
      ),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Model ID/i);
  });

  it("returns 400 when description is shorter than 10 characters", async () => {
    const res = await POST(
      buildRequest(
        { description: "short", modelId: "z-ai/glm4.7" },
        "ip-short-desc",
      ),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at least 10/i);
  });

  it("returns 200 with resultId on a valid submission", async () => {
    const res = await POST(
      buildRequest(
        {
          description: "Someone broke into a shop and took goods.",
          language: "english",
          modelId: "z-ai/glm4.7",
        },
        "ip-success",
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.resultId).toBe("result-uuid-123");
    expect(json.retrievedChunks).toHaveLength(1);
    expect(callChatAPI).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("analysis_results");
  });

  it("enforces rate limits on premium models after the cap", async () => {
    const ip = "ip-rate-test";
    // Premium cap is 10/min. Issue 10 successful requests, then expect 429.
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        buildRequest(
          {
            description: "Spam request testing rate limit.",
            language: "english",
            modelId: "z-ai/glm4.7",
          },
          ip,
        ),
      );
      expect(res.status).toBe(200);
    }

    const blocked = await POST(
      buildRequest(
        {
          description: "This one should be blocked.",
          language: "english",
          modelId: "z-ai/glm4.7",
        },
        ip,
      ),
    );
    expect(blocked.status).toBe(429);
    const json = await blocked.json();
    expect(json.error).toMatch(/Rate limit/i);
  });

  it("returns 500 when persistence fails", async () => {
    insertSelectSingle.mockImplementationOnce(async () => ({
      data: null,
      error: { message: "db down" },
    }));

    const res = await POST(
      buildRequest(
        {
          description: "Valid scenario triggering persistence failure.",
          language: "english",
          modelId: "z-ai/glm4.7",
        },
        "ip-persist-fail",
      ),
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Failed to save/i);
  });

  it("returns 400 for an invalid modelId (no leak through to NVIDIA)", async () => {
    const res = await POST(
      buildRequest(
        {
          description: "Some valid scenario for testing modelId validation.",
          language: "english",
          modelId: "gpt-4-mythical-edition",
        },
        "ip-bad-model",
      ),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid model ID/i);
    // Critically: the NVIDIA mock should NOT have been called.
    expect(callChatAPI).not.toHaveBeenCalled();
  });

  it("streams NDJSON when Accept: application/x-ndjson is set", async () => {
    // Mock a streaming SSE upstream response.
    const sseBody =
      'data: {"choices":[{"delta":{"content":"{\\"step1FactIdentification\\":\\"Facts\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"step2LegalClassification\\":\\"Theft\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"step3ElementsAnalysis\\":\\"E\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"step4DefensesAndMitigation\\":\\"D\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"step5SentencingFramework\\":\\"S\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"step6PrecedentApplication\\":\\"P\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"step7Conclusion\\":\\"C\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"estimatedPunishment\\":\\"X\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"confidenceLevel\\":\\"MEDIUM\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"confidenceReason\\":\\"r\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"proceduralRoadmap\\":\\"r\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"disclaimer\\":\\"d\\","}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"\\"isCivilMatter\\":false,\\"needsClarification\\":false,\\"rawResponse\\":\\"raw\\"}"}}]}\n\n' +
      "data: [DONE]\n\n";

    const fetchMock = vi.fn(
      async () =>
        new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.NVIDIA_API_KEY = "test-key";

    const req = {
      headers: {
        get: (key: string) => {
          const k = key.toLowerCase();
          if (k === "x-forwarded-for") return "ip-stream-analyze";
          if (k === "accept") return "application/x-ndjson";
          return null;
        },
      },
      json: async () => ({
        description: "Stream test: man broke window and stole laptop at night.",
        language: "english",
        modelId: "z-ai/glm4.7",
      }),
    } as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain(
      "application/x-ndjson",
    );

    const text = await res.text();
    const events = text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const types = events.map((e) => e.type);

    expect(types).toContain("status");
    expect(types).toContain("chunks");
    expect(types).toContain("delta");
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect(done.resultId).toBe("result-uuid-123");
    expect(done.result?.confidenceLevel).toBe("MEDIUM");

    vi.unstubAllGlobals();
  });
});
