/**
 * ScenarioForm Component
 *
 * Main form for submitting a legal scenario for analysis.
 * Includes language toggle, crime category, textarea, sliders, and model selector.
 */

import { useState, FormEvent, ChangeEvent } from 'react';
import { ScenarioFormProps, ScenarioInput, CrimeCategory, AnalysisLanguage } from '@/lib/types';
import ModelSelector from './ModelSelector';
import { DEFAULT_MODEL_ID } from '@/lib/models';

const CRIME_CATEGORIES: { value: CrimeCategory; label: string }[] = [
  { value: 'violent', label: 'Violent Crime' },
  { value: 'property', label: 'Property Crime' },
  { value: 'drug', label: 'Drug Offense' },
  { value: 'corruption', label: 'Corruption' },
  { value: 'terrorism', label: 'Terrorism' },
  { value: 'trafficking', label: 'Trafficking' },
  { value: 'other', label: 'Other' },
];

const MAX_DESCRIPTION_LENGTH = 5000;
const MIN_DESCRIPTION_LENGTH = 10;

export default function ScenarioForm({ onSubmit, isLoading = false }: ScenarioFormProps) {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<AnalysisLanguage>('english');
  const [selectedCategory, setSelectedCategory] = useState<CrimeCategory | undefined>(undefined);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [severity, setSeverity] = useState(5);
  const [intent, setIntent] = useState(5);
  const [history, setHistory] = useState(5);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (description.length < MIN_DESCRIPTION_LENGTH) {
      setValidationError(`Please provide at least ${MIN_DESCRIPTION_LENGTH} characters`);
      return;
    }
    setValidationError(null);

    const input: ScenarioInput = {
      description,
      language,
      modelId,
      crimeCategory: selectedCategory,
      severity,
      intent,
      history,
    };

    onSubmit(input);
  };

  const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(value);
      if (validationError) setValidationError(null);
    }
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'english' ? 'amharic' : 'english'));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Language Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Response Language
        </label>
        <button
          type="button"
          onClick={toggleLanguage}
          disabled={isLoading}
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors disabled:opacity-50"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              language === 'amharic' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400 w-20 text-right">
          {language === 'english' ? 'English' : 'Amharic'}
        </span>
      </div>

      {/* Crime Category */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Crime Category (Optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {CRIME_CATEGORIES.map((category) => (
            <button
              key={category.value}
              type="button"
              onClick={() => setSelectedCategory(
                selectedCategory === category.value ? undefined : category.value
              )}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
                selectedCategory === category.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description Textarea */}
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Scenario Description *
        </label>
        <textarea
          id="description"
          value={description}
          onChange={handleDescriptionChange}
          disabled={isLoading}
          rows={6}
          required
          minLength={MIN_DESCRIPTION_LENGTH}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Describe the situation in detail, including what happened, who was involved, and any relevant circumstances..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{description.length} / {MAX_DESCRIPTION_LENGTH} characters</span>
          <span>Minimum {MIN_DESCRIPTION_LENGTH} characters</span>
        </div>
        {validationError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {validationError}
          </p>
        )}
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Assessment Factors (Optional)
        </h4>

        {/* Severity Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor="severity" className="text-gray-600 dark:text-gray-400">
              Crime Severity
            </label>
            <span className="text-gray-900 dark:text-white font-medium">{severity}/10</span>
          </div>
          <input
            type="range"
            id="severity"
            min="1"
            max="10"
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            disabled={isLoading}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>

        {/* Intent Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor="intent" className="text-gray-600 dark:text-gray-400">
              Criminal Intent
            </label>
            <span className="text-gray-900 dark:text-white font-medium">{intent}/10</span>
          </div>
          <input
            type="range"
            id="intent"
            min="1"
            max="10"
            value={intent}
            onChange={(e) => setIntent(Number(e.target.value))}
            disabled={isLoading}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>

        {/* History Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor="history" className="text-gray-600 dark:text-gray-400">
              Prior Criminal History
            </label>
            <span className="text-gray-900 dark:text-white font-medium">{history}/10</span>
          </div>
          <input
            type="range"
            id="history"
            min="1"
            max="10"
            value={history}
            onChange={(e) => setHistory(Number(e.target.value))}
            disabled={isLoading}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>
      </div>

      {/* Model Selector */}
      <ModelSelector value={modelId} onChange={setModelId} disabled={isLoading} />

      {/* Submit Button */}
      <div className="space-y-2">
        <button
          type="submit"
          disabled={isLoading || description.length < MIN_DESCRIPTION_LENGTH}
          aria-describedby={
            description.length < MIN_DESCRIPTION_LENGTH
              ? 'submit-hint'
              : undefined
          }
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
            text-white font-semibold rounded-md shadow-sm transition-colors
            disabled:cursor-not-allowed"
        >
          {isLoading ? 'Analyzing...' : 'Get Legal Analysis'}
        </button>
        {description.length < MIN_DESCRIPTION_LENGTH && !isLoading && (
          <p
            id="submit-hint"
            className="text-xs text-gray-500 dark:text-gray-400 text-center"
            role="status"
          >
            Add at least{' '}
            {MIN_DESCRIPTION_LENGTH - description.length} more character
            {MIN_DESCRIPTION_LENGTH - description.length === 1 ? '' : 's'} to
            enable submission.
          </p>
        )}
      </div>
    </form>
  );
}
