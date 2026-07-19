/**
 * SourcesPanel Component
 * 
 * Displays retrieved law articles for transparency.
 * Shows which law chunks were used in the analysis.
 */

import { useState } from 'react';
import { SourcesPanelProps } from '@/lib/types';

export default function SourcesPanel({ chunks }: SourcesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!chunks || chunks.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Law Articles Retrieved
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          No specific law articles were retrieved for this scenario. The AI responded from general 
          legal knowledge rather than retrieved provisions. This may affect the accuracy of the analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Law Articles Retrieved ({chunks.length})
        </h3>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-4">
          {chunks.map((chunk, index) => (
            <div
              key={chunk.id}
              className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Source {index + 1}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(chunk.similarity * 100).toFixed(0)}% match
                </span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {chunk.articleReference}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Document: {chunk.documentName}
              </p>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {chunk.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
