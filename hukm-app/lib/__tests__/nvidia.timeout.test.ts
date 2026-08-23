/**
 * Timeout-budget tests against a local stub HTTP server (Fix I).
 *
 * The stub impersonates the NVIDIA wire format; env overrides point the
 * client at it with tiny budgets so deadline breaches resolve in
 * milliseconds instead of minutes.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

let server: http.Server;
let baseUrl = "";

// Populated in beforeAll AFTER env is set, so lazy config getters see it.
let nvidia: typeof import("../nvidia");
let embeddings: typeof import("../embeddings");

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let model = "";
      try {
        model = (JSON.parse(raw) as { model?: string }).model ?? "";
      } catch {
        /* ignore */
      }
      const isStream = raw.includes('"stream":true');

      if (!isStream) {
        if (model.startsWith("slow/")) {
          setTimeout(() => {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ choices: [{ message: { content: "late" } }] }));
          }, 5_000);
          return;
        }
        if (model.startsWith("fail500/")) {
          res.writeHead(500);
          res.end("boom");
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: `pong:${model}` } }],
          }),
        );
        return;
      }

      // Streaming cases.
      if (model.startsWith("stall/")) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "par" } }] })}\n\n`);
        // never finish — total budget must fire
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "he" } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "llo" } }] })}\n\n`);
      res.end("data: [DONE]\n\n");
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;

  process.env.NVIDIA_CHAT_URL = `${baseUrl}/v1/chat/completions`;
  process.env.NVIDIA_EMBED_URL = `${baseUrl}/v1/embeddings`;
  process.env.NVIDIA_API_KEY = "test-key";
  // Budgets are generous enough to survive full-suite CPU contention
  // (real HTTP round trips to the stub) while still being breached by
  // the deliberate stalls below.
  process.env.NVIDIA_CHAT_TIMEOUT_MS = "1000";
  process.env.NVIDIA_CHAIN_DEADLINE_MS = "3000";
  process.env.NVIDIA_STREAM_TTFB_MS = "800";
  process.env.NVIDIA_STREAM_TOTAL_MS = "1500";
  process.env.NVIDIA_EMBED_TIMEOUT_MS = "800";

  nvidia = await import("../nvidia");
  embeddings = await import("../embeddings");
});

afterAll(() => {
  server.close();
});

const messages = [{ role: "user" as const, content: "hi" }];

describe("callChat deadlines", () => {
  it("returns quickly on the happy path", async () => {
    const out = await nvidia.callChat({ modelId: "fast/m1", messages });
    expect(out.content).toBe("pong:fast/m1");
  });

  it("breaches the per-attempt deadline and maps to ChatApiError 504", async () => {
    const started = Date.now();
    await expect(
      nvidia.callChat({ modelId: "slow/m1", messages }),
    ).rejects.toMatchObject({ name: "ChatApiError", status: 504 });
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

describe("callChatWithFallback chain", () => {
  it("walks to the next candidate when the primary returns 500", async () => {
    const out = await nvidia.callChatWithFallback({
      modelId: "fail500/primary",
      messages,
    });
    // First fallback candidate answered.
    expect(out.content).toContain("pong:");
    expect(out.modelId).not.toBe("fail500/primary");
  });

  it("surfaces ChatApiError when the upstream never responds at all", async () => {
    // Point every attempt at a server that accepts but never answers;
    // per-attempt budgets + the chain guard must terminate with 504.
    const dead = http.createServer(() => {/* never respond */});
    await new Promise<void>((resolve) => dead.listen(0, "127.0.0.1", resolve));
    const deadPort = (dead.address() as AddressInfo).port;
    const originalUrl = process.env.NVIDIA_CHAT_URL;
    process.env.NVIDIA_CHAT_URL = `http://127.0.0.1:${deadPort}/v1/chat/completions`;

    try {
      const started = Date.now();
      await expect(
        nvidia.callChatWithFallback({ modelId: "any/m1", messages }),
      ).rejects.toMatchObject({ name: "ChatApiError", status: 504 });
      // chain guard (3s budget) stops the walk long before 6 × 1s.
      expect(Date.now() - started).toBeLessThan(6_000);
    } finally {
      dead.close();
      process.env.NVIDIA_CHAT_URL = originalUrl;
    }
  });
});

describe("streamFromCandidate budgets", () => {
  it("assembles SSE deltas and terminates at [DONE]", async () => {
    const deltas: string[] = [];
    const text = await nvidia.streamFromCandidate({
      modelId: "stream/ok",
      messages,
      maxTokens: 64,
      onToken: (d) => deltas.push(d),
    });
    expect(text).toBe("hello");
    expect(deltas.join("")).toBe("hello");
  });

  it("flags streamedPartial when the stream stalls mid-body", async () => {
    const deltas: string[] = [];
    const err = await nvidia
      .streamFromCandidate({
        modelId: "stall/m1",
        messages,
        maxTokens: 64,
        onToken: (d) => deltas.push(d),
      })
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ name: "ChatApiError", status: 504 });
    expect((err as { streamedPartial?: boolean }).streamedPartial).toBe(true);
    expect(deltas.length).toBeGreaterThanOrEqual(1);
  });
});

describe("embeddings deadline", () => {
  it("throws a timeout error when the embedding endpoint stalls", async () => {
    // Stub has no /v1/embeddings handler that responds fast for this test —
    // point embedUrl at a stalling path via the same slow semantics by using
    // an unrouted port instead.
    const dead = http.createServer(() => {/* never respond */});
    await new Promise<void>((resolve) => dead.listen(0, "127.0.0.1", resolve));
    const deadPort = (dead.address() as AddressInfo).port;
    process.env.NVIDIA_EMBED_URL = `http://127.0.0.1:${deadPort}/v1/embeddings`;

    const started = Date.now();
    await expect(embeddings.embed("some text", "query")).rejects.toThrow(/timed out/i);
    expect(Date.now() - started).toBeLessThan(2_000);

    dead.close();
    process.env.NVIDIA_EMBED_URL = `${baseUrl}/v1/embeddings`;
  });
});
