/**
 * Tests for /api/results/[id] and /api/conversations[/...] ownership.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  getSessionId: vi.fn(async () => "session-A"),
}));

const resultsRow = {
  id: "result-1",
  scenario_input: { description: "x" },
  result: { confidenceLevel: "MEDIUM" },
  model_id: "z-ai/glm4.7",
  created_at: "2025-01-01T00:00:00Z",
};

let resultOwner: string | null = "session-A";
let conversationOwner: string | null = "session-A";
let conversationsList: unknown[] = [];

const fromMock = vi.fn((table: string) => {
  if (table === "analysis_results") {
    return {
      select: () => ({
        eq: () => ({
          single: async () => {
            if (resultOwner === null) {
              return { data: null, error: { message: "not found" } };
            }
            // 1st call: ownership probe (session_id only). 2nd: full row.
            return {
              data: {
                ...resultsRow,
                session_id: resultOwner,
              },
              error: null,
            };
          },
        }),
      }),
    };
  }
  if (table === "conversations") {
    return {
      select: () => ({
        eq: () => ({
          single: async () => {
            if (conversationOwner === null) {
              return { data: null, error: { message: "not found" } };
            }
            return {
              data: {
                id: "conv-1",
                session_id: conversationOwner,
                scenario_description: "case",
                model_id: "z-ai/glm4.7",
                confidence_level: "MEDIUM",
                is_civil_matter: false,
                needs_clarification: false,
                created_at: "2025-01-01T00:00:00Z",
                updated_at: "2025-01-01T00:00:00Z",
              },
              error: null,
            };
          },
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: { id: "new-conv" },
            error: null,
          }),
        }),
      }),
    };
  }
  if (table === "messages") {
    return {
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "m" }, error: null }),
        }),
      }),
    };
  }
  return {} as unknown;
});

const rpcMock = vi.fn(async (name: string) => {
  if (name === "get_recent_conversations") {
    return { data: conversationsList, error: null };
  }
  if (name === "get_conversation_messages") {
    return { data: [], error: null };
  }
  return { data: null, error: { message: "unknown rpc" } };
});

vi.mock("@/lib/supabase", () => ({
  getServerClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

import { GET as resultGet } from "@/app/api/results/[id]/route";
import {
  GET as conversationGet,
  POST as conversationPost,
} from "@/app/api/conversations/route";
import { GET as conversationByIdGet } from "@/app/api/conversations/[id]/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/test", {
    method: "GET",
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
}

describe("GET /api/results/[id]", () => {
  beforeEach(() => {
    resultOwner = "session-A";
    fromMock.mockClear();
  });

  it("returns 200 + data when caller owns the row", async () => {
    const res = await resultGet(makeRequest(), { params: { id: "result-1" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("result-1");
  });

  it("returns 404 when another session owns the row (no enumeration leak)", async () => {
    resultOwner = "session-B";
    const res = await resultGet(makeRequest(), { params: { id: "result-1" } });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 404 when row does not exist", async () => {
    resultOwner = null;
    const res = await resultGet(makeRequest(), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/conversations", () => {
  beforeEach(() => {
    conversationsList = [{ id: "c", scenario_description: "x" }];
    rpcMock.mockClear();
  });

  it("returns the recent conversations for the session", async () => {
    const res = await conversationGet();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(conversationsList);
    expect(rpcMock).toHaveBeenCalledWith(
      "get_recent_conversations",
      expect.objectContaining({ p_session_id: "session-A" }),
    );
  });
});

describe("POST /api/conversations (with resultId)", () => {
  beforeEach(() => {
    resultOwner = "session-A";
  });

  it("creates a conversation seeded from a saved result", async () => {
    const req = new Request("http://localhost/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: "result-1" }),
    });
    const res = await conversationPost(req as unknown as Parameters<typeof conversationPost>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("new-conv");
  });

  it("returns 404 when caller does not own the source result (no enumeration leak)", async () => {
    resultOwner = "session-B";
    const req = new Request("http://localhost/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: "result-1" }),
    });
    const res = await conversationPost(req as unknown as Parameters<typeof conversationPost>[0]);
    expect(res.status).toBe(404);
  });

  it("creates a bare conversation with a valid model id", async () => {
    const req = new Request("http://localhost/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "z-ai/glm4.7" }),
    });
    const res = await conversationPost(req as unknown as Parameters<typeof conversationPost>[0]);
    expect(res.status).toBe(200);
  });

  it("rejects an invalid model id", async () => {
    const req = new Request("http://localhost/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "fake/model" }),
    });
    const res = await conversationPost(req as unknown as Parameters<typeof conversationPost>[0]);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/conversations/[id]", () => {
  beforeEach(() => {
    conversationOwner = "session-A";
  });

  it("returns conversation + messages for the owner", async () => {
    const res = await conversationByIdGet(makeRequest(), {
      params: { id: "conv-1" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.conversation.id).toBe("conv-1");
    expect(Array.isArray(json.data.messages)).toBe(true);
  });

  it("returns 404 when caller does not own the conversation (no enumeration leak)", async () => {
    conversationOwner = "session-B";
    const res = await conversationByIdGet(makeRequest(), {
      params: { id: "conv-1" },
    });
    expect(res.status).toBe(404);
  });
});
