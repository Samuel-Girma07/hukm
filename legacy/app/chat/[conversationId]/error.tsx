"use client";

import Link from 'next/link';

export default function ChatError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Conversation Error
        </h3>
        <p className="text-red-700 dark:text-red-300 mb-4">
          This conversation could not be loaded. It may have been deleted or you may not have permission to view it.
        </p>
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-md"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
