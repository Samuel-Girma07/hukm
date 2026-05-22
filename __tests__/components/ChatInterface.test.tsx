/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatInterface from "@/components/ChatInterface";

describe("ChatInterface", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty-state message when no initial messages are passed", () => {
    render(
      <ChatInterface
        conversationId="conv-1"
        modelId="z-ai/glm4.7"
        initialMessages={[]}
      />,
    );

    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Type your follow-up question/i),
    ).toBeInTheDocument();
  });

  it("renders existing messages from props", () => {
    render(
      <ChatInterface
        conversationId="conv-1"
        modelId="z-ai/glm4.7"
        initialMessages={[
          {
            id: "1",
            role: "user",
            content: "First user question",
            createdAt: new Date().toISOString(),
          },
          {
            id: "2",
            role: "assistant",
            content: "Assistant reply",
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByText("First user question")).toBeInTheDocument();
    expect(screen.getByText("Assistant reply")).toBeInTheDocument();
  });

  it("disables the Send button when input is empty", () => {
    render(
      <ChatInterface
        conversationId="conv-1"
        modelId="z-ai/glm4.7"
        initialMessages={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /Send/i })).toBeDisabled();
  });

  it("posts the message and renders the AI response on submit", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          response: "AI explained Article 525",
          conversationId: "conv-1",
          messageId: "msg-2",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatInterface
        conversationId="conv-1"
        modelId="z-ai/glm4.7"
        initialMessages={[]}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Type your follow-up question/i);
    fireEvent.change(textarea, { target: { value: "What about Article 525?" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    expect(screen.getByText("What about Article 525?")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("AI explained Article 525")).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      conversationId: "conv-1",
      message: "What about Article 525?",
      modelId: "z-ai/glm4.7",
    });
  });

  it("renders streamed NDJSON deltas progressively", async () => {
    const ndjson =
      JSON.stringify({ type: "delta", content: "Hello " }) +
      "\n" +
      JSON.stringify({ type: "delta", content: "world" }) +
      "\n" +
      JSON.stringify({
        type: "done",
        conversationId: "conv-1",
        messageId: "msg-stream-1",
      }) +
      "\n";

    const fetchMock = vi.fn(async () =>
      new Response(ndjson, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatInterface
        conversationId="conv-1"
        modelId="z-ai/glm4.7"
        initialMessages={[]}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Type your follow-up question/i);
    fireEvent.change(textarea, { target: { value: "Hi there" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() =>
      expect(screen.getByText(/Hello world/)).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>).Accept,
    ).toBe("application/x-ndjson");
  });

  it("shows an error and restores input on API failure", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatInterface
        conversationId="conv-1"
        modelId="z-ai/glm4.7"
        initialMessages={[]}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Type your follow-up question/i);
    fireEvent.change(textarea, { target: { value: "Trigger rate limit" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() =>
      expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument(),
    );
    // Failed message bubble should be removed from the chat history (the
    // textarea still contains the restored input value, so we look for the
    // <p> rendering of the message bubble specifically).
    expect(
      document.querySelectorAll('p.text-sm.whitespace-pre-wrap').length,
    ).toBe(0);
    // Input should be restored so user can retry/edit
    expect((textarea as HTMLTextAreaElement).value).toBe("Trigger rate limit");
  });
});
