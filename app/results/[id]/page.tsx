"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AnalysisResult from "@/components/AnalysisResult";
import {
  AnalysisResultWithSources,
  ScenarioInput,
} from "@/lib/types";
import { getDisplayName } from "@/lib/models";
import { logger } from "@/lib/logger";

interface LoadedAnalysis {
  input: ScenarioInput;
  result: AnalysisResultWithSources;
  modelName: string;
  timestamp: number;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const resultId = params.id as string;

  const [data, setData] = useState<LoadedAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  useEffect(() => {
    if (!resultId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/results/${resultId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setLoadError(json.error ?? "Result not found.");
          return;
        }

        const row = json.data as {
          scenario_input: ScenarioInput;
          result: AnalysisResultWithSources;
          model_id: string;
          created_at: string;
        };

        setData({
          input: row.scenario_input,
          result: row.result,
          modelName: getDisplayName(row.model_id),
          timestamp: new Date(row.created_at).getTime(),
        });
      } catch (err) {
        logger.error("Failed to load analysis result:", err);
        setLoadError("Failed to load analysis result.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [resultId]);

  const createConversation = async () => {
    if (!data || isCreatingConversation) return;
    setIsCreatingConversation(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create conversation");
      }
      router.push(`/chat/${json.data.id}`);
    } catch (error) {
      logger.error("Failed to create conversation:", error);
      alert("Failed to create conversation. Please try again.");
    } finally {
      setIsCreatingConversation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Result Not Found
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-4">
            {loadError || "We could not load this analysis."}
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
          >
            Start New Analysis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
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
          Back to Home
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Analysis Results
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Model: {data.modelName}</span>
              <span>•</span>
              <span>{new Date(data.timestamp).toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={createConversation}
            disabled={isCreatingConversation}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                       text-white font-medium rounded-md transition-colors
                       disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCreatingConversation ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Continue Conversation
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Scenario Description
        </h2>
        <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
          {data.input.description}
        </p>
        {data.input.crimeCategory && (
          <div className="mt-3">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {data.input.crimeCategory}
            </span>
          </div>
        )}
      </div>

      <AnalysisResult result={data.result} modelName={data.modelName} />
    </div>
  );
}
