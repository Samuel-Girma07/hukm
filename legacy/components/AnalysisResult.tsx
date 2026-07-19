/**
 * AnalysisResult Component
 * 
 * Displays the complete AI analysis result.
 * Handles three cases: civil matter, needs clarification, full analysis.
 */

import { AnalysisResultComponentProps } from '@/lib/types';
import StepCard from './StepCard';
import ConfidenceBadge from './ConfidenceBadge';
import SourcesPanel from './SourcesPanel';

export default function AnalysisResult({ result, modelName }: AnalysisResultComponentProps) {
  // Case 1: Civil Matter
  if (result.isCivilMatter) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Civil Matter Identified
          </h3>
          <p className="text-blue-700 dark:text-blue-300">
            {result.civilExplanation || 'This appears to be a civil dispute rather than a criminal matter.'}
          </p>
        </div>
        
        {result.step7Conclusion && (
          <StepCard stepNumber={1} title="Conclusion">
            {result.step7Conclusion}
          </StepCard>
        )}
        
        <Disclaimer text={result.disclaimer} />
      </div>
    );
  }

  // Case 2: Needs Clarification
  if (result.needsClarification && result.clarifyingQuestions && result.clarifyingQuestions.length > 0) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Clarification Needed
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-4">
            Please provide more information to enable a proper legal analysis:
          </p>
          <ul className="list-disc list-inside space-y-2 text-yellow-700 dark:text-yellow-300">
            {result.clarifyingQuestions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
        
        <Disclaimer text={result.disclaimer} />
      </div>
    );
  }

  // Case 3: Full Analysis
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Analysis Summary
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <ConfidenceBadge level={result.confidenceLevel} reason={result.confidenceReason} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Model: {modelName}
          </p>
          {result.estimatedPunishment && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estimated Punishment
              </h4>
              <p className="text-gray-900 dark:text-white">{result.estimatedPunishment}</p>
            </div>
          )}
        </div>
      </div>

      {/* Seven Reasoning Steps */}
      <div className="space-y-4">
        <StepCard stepNumber={1} title="Fact Identification">
          {result.step1FactIdentification}
        </StepCard>
        
        <StepCard stepNumber={2} title="Legal Classification">
          {result.step2LegalClassification}
        </StepCard>
        
        <StepCard stepNumber={3} title="Elements Analysis">
          {result.step3ElementsAnalysis}
        </StepCard>
        
        <StepCard stepNumber={4} title="Defenses and Mitigation">
          {result.step4DefensesAndMitigation}
        </StepCard>
        
        <StepCard stepNumber={5} title="Sentencing Framework">
          {result.step5SentencingFramework}
        </StepCard>
        
        <StepCard stepNumber={6} title="Precedent Application">
          {result.step6PrecedentApplication}
        </StepCard>
        
        <StepCard stepNumber={7} title="Conclusion">
          {result.step7Conclusion}
        </StepCard>
      </div>

      {/* Procedural Roadmap */}
      {result.proceduralRoadmap && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Procedural Roadmap
          </h3>
          <p className="text-gray-700 dark:text-gray-300">{result.proceduralRoadmap}</p>
        </div>
      )}

      {/* Sources Panel */}
      <SourcesPanel chunks={result.retrievedChunks} />

      {/* Disclaimer */}
      <Disclaimer text={result.disclaimer} />
    </div>
  );
}

/**
 * Disclaimer sub-component
 */
function Disclaimer({ text }: { text: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        <strong>Disclaimer:</strong> {text}
      </p>
    </div>
  );
}
