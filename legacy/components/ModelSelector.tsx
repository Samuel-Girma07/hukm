/**
 * ModelSelector Component
 * 
 * Dropdown for selecting the AI model.
 * Imports model data from lib/models.ts - never hardcodes.
 */

import { ModelSelectorProps } from '@/lib/types';
import { PRIMARY_MODELS, FALLBACK_MODELS, DEFAULT_MODEL_ID, getDisplayName } from '@/lib/models';

export default function ModelSelector({ value, onChange, disabled = false }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        AI Model
      </label>
      <select
        id="model-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <optgroup label="Primary Models">
          {PRIMARY_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </optgroup>
        <optgroup label="Fallback Models">
          {FALLBACK_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </optgroup>
      </select>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Default: {getDisplayName(DEFAULT_MODEL_ID)}
      </p>
    </div>
  );
}
