"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { getDisplayName } from "@/lib/models";

interface ConversationSummary {
  id: string;
  scenario_description: string | null;
  first_user_message: string | null;
  model_id: string;
  confidence_level: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

function previewFor(c: ConversationSummary): string {
  const desc = c.scenario_description?.trim();
  if (desc) return desc;
  const fallback = c.first_user_message?.trim();
  if (fallback) return fallback;
  return "Untitled conversation";
}

export default function ConversationsListPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/conversations");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to load conversations");
        }
        setConversations(json.data as ConversationSummary[]);
      } catch (err) {
        logger.error("Failed to load conversations:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load conversations",
        );
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Conversations
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your recent conversations on this device.
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          New Analysis
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && conversations.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            You haven&apos;t started any conversations yet.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Start your first analysis
          </Link>
        </div>
      )}

      {!isLoading && !error && conversations.length > 0 && (
        <ul className="space-y-3">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {previewFor(c)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {getDisplayName(c.model_id)} •{" "}
                      {Number(c.message_count)} messages • Updated{" "}
                      {new Date(c.updated_at).toLocaleString()}
                    </p>
                  </div>
                  {c.confidence_level && (
                    <span
                      className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.confidence_level === "HIGH"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : c.confidence_level === "MEDIUM"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : c.confidence_level === "LOW"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {c.confidence_level}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
