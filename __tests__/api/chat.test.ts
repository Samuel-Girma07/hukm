/**
 * Integration tests for POST /api/chat (v2 contract).
 *
 * Contract changes vs v1:
 *   - `conversationId` is now REQUIRED. /api/chat never auto-creates a
 *     conversation; callers must POST /api/conversations first.
 *   - Ownership is asserted via lib/ownership.assertOwnsConversation,
 *     which queries supabase.from("conversations").select("session_id").
 *     Tests therefore mock that branch.
 *
 * NVIDIA, Supabase, RAG, and session helpers are stubbed at module level so
 * the route handler can be exercised without network or database access.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  getSessionId: vi.fn(async () => "test-session-id"),
}));

vi.mock("@/lib/rag", () => ({
  retrieveRelevantChunks: vi.fn(async () => []),
}));

const userMsgInsert = vi.fn(async () => ({
  data: { id: "msg-user-1" },
  error: null,
}));
const assistantMsgInsert = vi.fn(async () => ({
  data: { id: "msg-asst-1" },
  error: null,
}));
const rpcMock = vi.fn(async () => ({ data: [], error: null }));

// session-id of the row owned by `assertOwnsConversation`. Setting this to
// the same value `getSessionId` returns means the caller "owns" it.
let conversationOwner: string | null = "test-session-id";

let messagesCallIndex = 0;

const fromMock = vi.fn((table: string) => {
  if (table === "conversations") {
    return {
      select: () => ({
        eq: () => ({
          single: async () => {
            if (conversationOwner === null) {
              return { data: null, error: { message: "not found" } };
            }
            return {
              data: { session_id: conversationOwner },
              error: null,
            };
          },
        }),
      }),
    };
  }
  if (table === "messages") {
    return {
      insert: () => ({
        select: () => ({
          single: async () => {
            messagesCallIndex += 1;
            if (messagesCallIndex === 1) return userMsgInsert();
            return assistantMsgInsert();
          },
        }),
      }),
    };
  }
  return {
    insert: () => ({
      select: () => ({ single: async () => ({ data: null, error: null }) }),
    }),
  };
});

vi.mock("@/lib/supabase", () => ({
  getServerClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

import { POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";

function buildRequest(
  body: unknown,
  ip = "127.0.0.1",
  extraHeaders: Record<string, string> = {},
): NextRequest {
  return {
    headers: {
      get: (key: string) => {
        const k = key.toLowerCase();
        if (k === "x-forwarded-for") return ip;
        if (extraHeaders[k] !== undefined) return extraHeaders[k];
        return null;
      },
    },
    json: async () => body,
  } as unknown as NextRequest;
}

const fetchMock = vi.fn(
  async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "AI response text" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
);

describe("POST /api/chat", () => {
  beforeEach(() => {
    process.env.NVIDIA_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    userMsgInsert.mockClear();
    assistantMsgInsert.mockClear();
    rpcMock.mockClear();
    fromMock.mockClear();
    messagesCallIndex = 0;
    conversationOwner = "test-session-id";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for missing message", async () => {
    const res = await POST(
      buildRequest(
        { modelId: "z-ai/glm4.7", conversationId: "conv-existing" },
        "ip-chat-missing-msg",
      ),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Message/i);
  });

  it("returns 400 for invalid model id", async () => {
    const res = await POST(
      buildRequest(
        {
          message: "hello",
          modelId: "fake/model",
          conversationId: "conv-existing",
        },
        "ip-chat-bad-model",
      ),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid model ID/i);
  });

  it("returns 400 when conversationId is missing (no auto-create)", async () => {
    const res = await POST(
      buildRequest(
        { message: "hi", modelId: "z-ai/glm4.7" },
        "ip-chat-no-convid",
      ),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Conversation ID/i);
  });

  it("returns 404 when caller does not own the conversation", async () => {
    conversationOwner = "different-session";
    const res = await POST(
      buildRequest(
        {
          message: "hi",
          modelId: "z-ai/glm4.7",
          conversationId: "someone-elses-conv",
        },
        "ip-chat-bad-owner",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when conversationId does not exist", async () => {
    conversationOwner = null;
    const res = await POST(
      buildRequest(
        {
          message: "hi",
          modelId: "z-ai/glm4.7",
          conversationId: "ghost-uuid",
        },
        "ip-chat-ghost",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("uses an existing conversation id and returns AI response", async () => {
    const res = await POST(
      buildRequest(
        {
          conversationId: "existing-conv-uuid",
          message: "Follow up question",
          modelId: "z-ai/glm4.7",
        },
        "ip-chat-existing",
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.conversationId).toBe("existing-conv-uuid");
    expect(json.response).toBe("AI response text");
    expect(userMsgInsert).toHaveBeenCalledTimes(1);
    expect(assistantMsgInsert).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when NVIDIA returns a non-OK status", async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response("upstream failure", { status: 503 }),
    );

    const res = await POST(
      buildRequest(
        {
          message: "Why?",
          modelId: "z-ai/glm4.7",
          conversationId: "existing-conv",
        },
        "ip-chat-nvidia-down",
      ),
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/AI service unavailable/i);
  });

  it("streams NDJSON deltas when Accept is application/x-ndjson", async () => {
    const sseBody =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      "data: [DONE]\n\n";

    fetchMock.mockImplementationOnce(
      async () =>
        new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
    );

    const req = buildRequest(
      {
        message: "Stream me a reply",
        modelId: "z-ai/glm4.7",
        conversationId: "existing-conv",
      },
      "ip-stream-test",
      { accept: "application/x-ndjson" },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain(
      "application/x-ndjson",
    );

    const text = await res.text();
    const lines = text.split("\n").filter(Boolean);
    const events = lines.map((l) => JSON.parse(l));
    const deltas = events.filter((e) => e.type === "delta");
    expect(deltas.map((d) => d.content).join("")).toBe("Hello");
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect(done.conversationId).toBe("existing-conv");
  });

  it("enforces rate limiting on premium models", async () => {
    const ip = "ip-chat-rate-limit";
    for (let i = 0; i < 10; i++) {
      const r = await POST(
        buildRequest(
          {
            message: `Message ${i}`,
            modelId: "z-ai/glm4.7",
            conversationId: "existing-conv",
          },
          ip,
        ),
      );
      expect(r.status).toBe(200);
    }
    const blocked = await POST(
      buildRequest(
        {
          message: "blocked",
          modelId: "z-ai/glm4.7",
          conversationId: "existing-conv",
        },
        ip,
      ),
    );
    expect(blocked.status).toBe(429);
  });
});
