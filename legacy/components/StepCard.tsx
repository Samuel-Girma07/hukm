/**
 * StepCard Component
 * 
 * Displays a numbered step card for the analysis reasoning steps.
 */

import { StepCardProps } from '@/lib/types';

export default function StepCard({ stepNumber, title, children }: StepCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
          {stepNumber}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  );
}
