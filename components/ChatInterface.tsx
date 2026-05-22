/**
 * ChatInterface Component
 *
 * Multi-turn chat UI. Streams responses from /api/chat using NDJSON
 * (Accept: application/x-ndjson) and falls back to a buffered JSON
 * response if streaming isn't available.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { logger } from "@/lib/logger";
import MessageMarkdown from "./MessageMarkdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages?: Message[];
  modelId: string;
}

interface NdjsonEvent {
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
  conversationId?: string;
  messageId?: string;
  retrievedChunks?: unknown[];
}

export default function ChatInterface({
  conversationId,
  initialMessages = [],
  modelId,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    // First paint: jump instantly to the bottom so the user sees the
    // latest message without a visible scroll animation. Subsequent
    // updates animate smoothly so streamed deltas feel alive.
    messagesEndRef.current?.scrollIntoView({
      behavior: hasMountedRef.current ? "smooth" : "auto",
      block: "end",
    });
    hasMountedRef.current = true;
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const messageText = input.trim();
    if (!messageText || isLoading) return;

    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Optimistic empty assistant message we'll fill in as deltas arrive.
    const assistantLocalId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantLocalId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          conversationId,
          message: messageText,
          modelId,
        }),
      });

      if (!response.ok) {
        let errMsg = `Request failed (${response.status})`;
        try {
          const json = await response.json();
          errMsg = json.error ?? errMsg;
        } catch {
          /* body wasn't JSON */
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/x-ndjson") && response.body) {
        await consumeNdjsonStream(response.body, assistantLocalId, setMessages);
      } else {
        // Fallback: buffered JSON response
        const json = await response.json();
        if (!json.success) {
          throw new Error(json.error ?? "Failed to send message");
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantLocalId
              ? {
                  ...m,
                  id: json.messageId ?? assistantLocalId,
                  content: json.response,
                }
              : m,
          ),
        );
      }
    } catch (err) {
      logger.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove the optimistic user + assistant bubbles on error.
      setMessages((prev) =>
        prev.filter(
          (m) => m.id !== userMessage.id && m.id !== assistantLocalId,
        ),
      );
      setInput(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No messages yet</p>
            <p className="text-sm mt-2">
              Start the conversation with a question
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                }`}
              >
                {message.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content || (
                      <span className="opacity-60 italic">…</span>
                    )}
                  </p>
                ) : message.content ? (
                  <MessageMarkdown content={message.content} />
                ) : (
                  <p className="text-sm">
                    <span className="opacity-60 italic">…</span>
                  </p>
                )}
                <p
                  className={`text-xs mt-2 ${
                    message.role === "user"
                      ? "text-blue-100"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
              <div className="flex space-x-2">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-2 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
        <form onSubmit={sendMessage} className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your follow-up question..."
            disabled={isLoading}
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       resize-none"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white font-medium rounded-md transition-colors
                       disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

async function consumeNdjsonStream(
  body: ReadableStream<Uint8Array>,
  assistantLocalId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx = buffer.indexOf("\n");
    while (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      newlineIdx = buffer.indexOf("\n");

      if (!line) continue;
      let event: NdjsonEvent;
      try {
        event = JSON.parse(line) as NdjsonEvent;
      } catch (err) {
        logger.warn("Bad NDJSON line:", line, err);
        continue;
      }

      if (event.type === "delta" && event.content) {
        const piece = event.content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantLocalId
              ? { ...m, content: m.content + piece }
              : m,
          ),
        );
      } else if (event.type === "done") {
        if (event.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantLocalId
                ? { ...m, id: event.messageId as string }
                : m,
            ),
          );
        }
      } else if (event.type === "error") {
        throw new Error(event.error ?? "Streaming error");
      }
    }
  }
}
