/**
 * LoadingState Component
 * 
 * Displays loading state with model name.
 */

import { LoadingStateProps } from '@/lib/types';

export default function LoadingState({ modelName }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Analyzing your scenario...
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Using {modelName}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 max-w-md text-center">
        Retrieving relevant Ethiopian law articles and generating structured legal analysis
      </p>
    </div>
  );
}
