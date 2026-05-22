/**
 * Chat Conversation Page
 *
 * Full-page conversation view at /chat/[conversationId]
 * Loads via the server API so RLS can stay locked down.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";
import { logger } from "@/lib/logger";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  scenario_description: string;
  model_id: string;
  created_at: string;
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Conversation not found");
        }

        setConversation(json.data.conversation);
        const rawMessages = (json.data.messages ?? []) as Array<{
          id: string;
          role: "user" | "assistant" | "system";
          content: string;
          created_at: string;
        }>;
        setMessages(
          rawMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
          })),
        );
      } catch (err) {
        logger.error("Error loading conversation:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load conversation",
        );
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [conversationId]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
          Loading conversation...
        </p>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Error Loading Conversation
          </h3>
          <p className="text-red-700 dark:text-red-300">
            {error || "Conversation not found"}
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/conversations"
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          All conversations
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Conversation
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {messages.length} messages • Started{" "}
              {new Date(conversation.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Model: {conversation.model_id}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {conversation.scenario_description?.slice(0, 100)}
              {conversation.scenario_description &&
              conversation.scenario_description.length > 100
                ? "..."
                : ""}
            </p>
          </div>
        </div>
      </div>

      <ChatInterface
        conversationId={conversationId}
        initialMessages={messages}
        modelId={conversation.model_id}
      />
    </div>
  );
}
