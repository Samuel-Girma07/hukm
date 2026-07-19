/**
 * Tests for retrieveRelevantChunks — specifically the v2 two-stage fallback
 * that retries at threshold 0 if the primary call (threshold 0.3) returns
 * no rows. Embedding + Supabase are stubbed at module level.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const embedMock = vi.fn(async () => Array.from({ length: 1024 }, () => 0.1));
const rpcMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getServerClient: () => ({
    rpc: rpcMock,
  }),
}));

beforeEach(() => {
  rpcMock.mockReset();
  embedMock.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ embedding: Array.from({ length: 1024 }, () => 0.1) }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  process.env.NVIDIA_API_KEY = "test-key";
});

describe("retrieveRelevantChunks — two-stage fallback", () => {
  it("returns the primary rows when the 0.3 threshold call yields matches", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          document_name: "criminal-code-414-2004",
          article_reference: "Article 525",
          content: "Theft text.",
          metadata: {},
          similarity: 0.62,
        },
      ],
      error: null,
    });

    const { retrieveRelevantChunks } = await import("@/lib/rag");
    const result = await retrieveRelevantChunks("test scenario about theft", 8);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].articleReference).toBe("Article 525");
    expect(rpcMock.mock.calls[0][1]).toMatchObject({ match_threshold: 0.3 });
  });

  it("falls back to threshold 0 when the primary call returns 0 rows", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 7,
            document_name: "constitution-1995",
            article_reference: "Article 17",
            content: "Liberty…",
            metadata: {},
            similarity: 0.21,
          },
        ],
        error: null,
      });

    const { retrieveRelevantChunks } = await import("@/lib/rag");
    const result = await retrieveRelevantChunks("vague question");

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][1]).toMatchObject({ match_threshold: 0.3 });
    expect(rpcMock.mock.calls[1][1]).toMatchObject({ match_threshold: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].articleReference).toBe("Article 17");
  });

  it("returns [] (and never throws) when both calls fail", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { retrieveRelevantChunks } = await import("@/lib/rag");
    const result = await retrieveRelevantChunks("anything");
    expect(result).toEqual([]);
  });

  it("returns [] gracefully when fallback also yields 0 rows", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const { retrieveRelevantChunks } = await import("@/lib/rag");
    const result = await retrieveRelevantChunks("nothing matches this");
    expect(result).toEqual([]);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
