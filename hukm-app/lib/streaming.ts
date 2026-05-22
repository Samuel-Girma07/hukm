/**
 * HUKM — SSE helpers shared by client and server.
 *
 * `parseSSEStream(response)` is an async generator that yields parsed
 * `data: …` events from a `text/event-stream` response. The generator
 * stops when it reads `data: [DONE]` or the stream ends.
 *
 * The server-side equivalents (build a stream of events) live next to
 * the route handlers; this file is the reader.
 */

export type StreamPhase =
  | "retrieving"
  | "analyzing"
  | "synthesizing"
  | "persisting";

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "phase"; phase: StreamPhase }
  | {
      type: "done";
      resultId?: string;
      conversationId?: string;
      messageId?: string;
      retrievedChunks?: unknown[];
      result?: unknown;
      response?: string;
      cache?: boolean;
      retrieval?: unknown;
    }
  | { type: "error"; error: string; code?: string };

interface ParseResult {
  /** Internal hint that the [DONE] sentinel was seen. */
  isDone?: boolean;
  /** The parsed JSON payload, if it parsed. */
  parsed?: StreamEvent;
}

function parseDataLine(payload: string): ParseResult {
  if (payload === "[DONE]") return { isDone: true };
  try {
    const obj = JSON.parse(payload) as StreamEvent;
    if (obj && typeof obj === "object" && "type" in obj) {
      return { parsed: obj };
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Reads an SSE response and yields parsed events. Tolerant of:
 *  - lines that aren't `data: …` (skipped)
 *  - JSON parse errors (skipped)
 *  - early disconnects (resolves)
 *  - `data: [DONE]` (terminates)
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<StreamEvent, void, void> {
  if (!response.body) return;
  const reader = response.body.getReader();
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
        if (payload.length === 0) continue;
        const result = parseDataLine(payload);
        if (result.isDone) return;
        if (result.parsed) yield result.parsed;
      }
    }
    // Flush any final buffered line.
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice("data:".length).trim();
      if (payload.length > 0) {
        const result = parseDataLine(payload);
        if (!result.isDone && result.parsed) yield result.parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Encodes a single SSE event as a UTF-8 buffer suitable for
 * `controller.enqueue()` from a server-side ReadableStream.
 */
export function encodeSSE(event: StreamEvent | "DONE"): Uint8Array {
  const encoder = new TextEncoder();
  if (event === "DONE") {
    return encoder.encode("data: [DONE]\n\n");
  }
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}
