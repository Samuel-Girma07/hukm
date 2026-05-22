/**
 * HUKM — Type Definitions
 * 
 * All TypeScript interfaces and types used throughout the application.
 */

// ============================================================================
// LAW CHUNK (Retrieved from Supabase)
// ============================================================================

/**
 * Represents a law article chunk retrieved from the vector database
 */
export interface LawChunk {
  id: number;
  documentName: string;           // e.g., 'criminal-code-414-2004'
  articleReference: string;        // e.g., 'Article 688 — Robbery with Violence'
  content: string;                 // The actual law text
  metadata: LawChunkMetadata;
  similarity: number;              // Similarity score (0.0 to 1.0)
}

/**
 * Metadata for a law chunk
 */
export interface LawChunkMetadata {
  source?: string;                 // Original filename
  proclamationNumber?: string;     // e.g., '414/2004'
  year?: number;
  pageNumber?: number;
  [key: string]: string | number | undefined;
}

// ============================================================================
// SCENARIO INPUT (User Form)
// ============================================================================

/**
 * Crime category options for the form
 */
export type CrimeCategory = 
  | 'violent'
  | 'property'
  | 'drug'
  | 'corruption'
  | 'terrorism'
  | 'trafficking'
  | 'other';

/**
 * Language option for the analysis
 */
export type AnalysisLanguage = 'english' | 'amharic';

/**
 * Input from the scenario form
 */
export interface ScenarioInput {
  description: string;             // User's scenario description (10-5000 chars)
  language: AnalysisLanguage;      // Response language
  modelId: string;                 // Selected model ID from registry
  crimeCategory?: CrimeCategory;   // Optional crime category
  severity?: number;               // 1-10 slider for crime severity
  intent?: number;                 // 1-10 slider for criminal intent
  history?: number;                // 1-10 slider for prior criminal history
}

// ============================================================================
// ANALYSIS RESULT (AI Response)
// ============================================================================

/**
 * Confidence level for the analysis
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NEEDS_REVIEW';

/**
 * The complete analysis result from the AI
 */
export interface AnalysisResult {
  // Core reasoning steps (7 steps)
  step1FactIdentification: string;
  step2LegalClassification: string;
  step3ElementsAnalysis: string;
  step4DefensesAndMitigation: string;
  step5SentencingFramework: string;
  step6PrecedentApplication: string;
  step7Conclusion: string;
  
  // Punishment estimation
  estimatedPunishment: string;
  
  // Confidence assessment
  confidenceLevel: ConfidenceLevel;
  confidenceReason: string;
  
  // Procedural guidance
  proceduralRoadmap: string;
  
  // Disclaimer
  disclaimer: string;
  
  // Civil matter handling
  isCivilMatter: boolean;
  civilExplanation?: string;
  
  // Clarification protocol
  needsClarification: boolean;
  clarifyingQuestions?: string[];
  
  // Raw response for debugging
  rawResponse: string;
}

/**
 * Analysis result with retrieved law chunks for transparency display
 */
export interface AnalysisResultWithSources extends AnalysisResult {
  retrievedChunks: LawChunk[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request body for the /api/analyze endpoint
 */
export interface AnalyzeRequest {
  description: string;
  language: AnalysisLanguage;
  modelId: string;
  crimeCategory?: CrimeCategory;
  severity?: number;
  intent?: number;
  history?: number;
}

/**
 * Response from the /api/analyze endpoint
 */
export interface AnalyzeResponse {
  success: boolean;
  resultId?: string;
  result?: AnalysisResult;
  error?: string;
  modelId: string;
  retrievedChunks: LawChunk[];
}

/**
 * Persisted analysis record stored in Supabase.
 */
export interface PersistedAnalysisResult {
  id: string;
  session_id: string;
  scenario_input: ScenarioInput;
  result: AnalysisResultWithSources;
  model_id: string;
  created_at: string;
}

// ============================================================================
// SESSION STORAGE TYPES
// ============================================================================

/**
 * Data stored in sessionStorage after analysis
 */
export interface AnalysisSessionData {
  input: ScenarioInput;
  result: AnalysisResultWithSources;
  modelName: string;
  timestamp: number;
}

// ============================================================================
// COMPONENT TYPES
// ============================================================================

/**
 * Props for StepCard component
 */
export interface StepCardProps {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
}

/**
 * Props for ConfidenceBadge component
 */
export interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  reason: string;
}

/**
 * Props for LoadingState component
 */
export interface LoadingStateProps {
  modelName: string;
}

/**
 * Props for ErrorState component
 */
export interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Props for SourcesPanel component
 */
export interface SourcesPanelProps {
  chunks: LawChunk[];
}

/**
 * Props for ModelSelector component
 */
export interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

/**
 * Props for ScenarioForm component
 */
export interface ScenarioFormProps {
  onSubmit: (input: ScenarioInput) => void;
  isLoading?: boolean;
}

/**
 * Props for AnalysisResult component
 */
export interface AnalysisResultComponentProps {
  result: AnalysisResultWithSources;
  modelName: string;
}
