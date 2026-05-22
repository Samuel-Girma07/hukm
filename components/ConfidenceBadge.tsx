/**
 * ConfidenceBadge Component
 * 
 * Displays the confidence level badge with color coding.
 */

import { ConfidenceBadgeProps } from '@/lib/types';

export default function ConfidenceBadge({ level, reason }: ConfidenceBadgeProps) {
  const getColorClasses = () => {
    switch (level) {
      case 'HIGH':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'LOW':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className={`inline-flex flex-col px-4 py-2 rounded-lg ${getColorClasses()}`}>
      <span className="text-sm font-semibold">{level} Confidence</span>
      {reason && (
        <span className="text-xs mt-1 opacity-80">{reason}</span>
      )}
    </div>
  );
}
