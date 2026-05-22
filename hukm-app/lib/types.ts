/**
 * HUKM — Shared TypeScript types.
 *
 * The interfaces here are the contract between the API routes, the
 * RAG pipeline, the AI layer, and the UI. Keep them in sync with the
 * Supabase schema (see docs/ARCHITECTURE.md).
 */

// ---------------------------------------------------------------------------
// Domain primitives
// ---------------------------------------------------------------------------

export type Language = "en" | "am";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "NEEDS_REVIEW";

export type CrimeCategory =
  | "homicide"
  | "assault"
  | "theft"
  | "fraud"
  | "drug_offense"
  | "sexual_offense"
  | "property_damage"
  | "corruption"
  | "traffic_offense"
  | "cybercrime"
  | "other";

// ---------------------------------------------------------------------------
// Scenario context (sliders)
// ---------------------------------------------------------------------------

/**
 * Optional per-axis context the user can set with the advanced sliders.
 * The values are 1..5 inclusive. Defaults are 3/3/1; we only inject
 * them into the prompt when they differ from the defaults so users who
 * leave the panel collapsed don't bias the analysis.
 */
export interface ScenarioContext {
  severity?: number;
  intent?: number;
  history?: number;
}

// ---------------------------------------------------------------------------
// Law chunks (returned by the match_law_chunks RPC)
// ---------------------------------------------------------------------------

export interface LawChunk {
  id: number;
  document_name: string;
  article_reference: string;
  content: string;
  similarity: number;
  /** True if this chunk was fetched via citation chaining, not vector search */
  _expanded?: boolean;
}

export interface RetrievalResult {
  chunks: LawChunk[];
  /** 1 = high-confidence stage (threshold 0.3), 2 = fallback stage (threshold 0). */
  stage: 1 | 2;
  maxSimilarity: number;
  /** Number of chunks added via citation chaining */
  expandedCount?: number;
}

// ---------------------------------------------------------------------------
// Analysis result (the strict 7-step JSON the analysis prompt requests)
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  step1FactIdentification: string;
  step2LegalClassification: string;
  step3ElementsAnalysis: string;
  step4DefensesAndMitigation: string;
  step5SentencingFramework: string;
  step6PrecedentApplication: string;
  step7Conclusion: string;
  estimatedPunishment: string;
  confidenceLevel: ConfidenceLevel;
  confidenceReason: string;
  proceduralRoadmap: string;
  disclaimer: string;
  isCivilMatter: boolean;
  civilExplanation?: string;
  needsClarification: boolean;
  clarifyingQuestions?: string[];
  /** 0–3 concise follow-up questions the model thinks the user might ask next. */
  suggestedFollowUps?: string[];
  /** The crime category the model inferred from the scenario, free-form. */
  detectedCrimeCategory?: string;
  rawResponse: string;
}

// ---------------------------------------------------------------------------
// Persisted shapes (analysis_results, conversations, messages)
// ---------------------------------------------------------------------------

export interface ScenarioInput {
  scenario: string;
  modelId: string;
  language: Language;
  sessionId?: string;
  crimeCategory?: CrimeCategory;
  scenarioContext?: ScenarioContext;
}

export interface PersistedAnalysisResultBlob extends AnalysisResult {
  retrievedChunks: LawChunk[];
  retrieval?: RetrievalResult;
}

export interface PersistedAnalysis {
  id: string;
  session_id: string;
  scenario_input: ScenarioInput;
  result: PersistedAnalysisResultBlob;
  model_id: string;
  created_at: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  session_id: string;
  user_id: string | null;
  scenario_description: string | null;
  model_id: string;
  confidence_level: ConfidenceLevel | null;
  is_civil_matter: boolean;
  needs_clarification: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

export interface AnalyzeRequest {
  scenario: string;
  modelId: string;
  sessionId?: string;
  language?: Language;
  crimeCategory?: CrimeCategory;
  scenarioContext?: ScenarioContext;
}

export interface AnalyzeSuccessResponse {
  success: true;
  resultId: string;
  result: AnalysisResult;
  modelId: string;
  retrievedChunks: LawChunk[];
  retrieval: RetrievalResult;
  cache: boolean;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type AnalyzeResponse = AnalyzeSuccessResponse | ApiErrorResponse;

export interface ChatRequest {
  message: string;
  conversationId: string;
  sessionId: string;
}

export interface ChatSuccessResponse {
  success: true;
  conversationId: string;
  messageId: string;
  response: string;
  retrievedChunks: LawChunk[];
}

export type ChatResponse = ChatSuccessResponse | ApiErrorResponse;

export interface CreateConversationRequest {
  sessionId: string;
  analysisId?: string;
  scenarioDescription: string;
  modelId: string;
}

export interface CreateConversationSuccessResponse {
  success: true;
  conversationId: string;
}

export type CreateConversationResponse =
  | CreateConversationSuccessResponse
  | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export interface CreateShareSuccessResponse {
  success: true;
  shareUrl: string;
  token: string;
}

export type CreateShareResponse = CreateShareSuccessResponse | ApiErrorResponse;

export interface ShareViewSuccessResponse {
  success: true;
  token: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  modelId: string;
  scenario: string;
  viewCount: number;
  createdAt: string;
}

export type ShareViewResponse = ShareViewSuccessResponse | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export type FeedbackRating = 1 | -1;

export interface FeedbackSubmitRequest {
  analysisId: string;
  rating: FeedbackRating;
  comment?: string;
}

export interface FeedbackSubmitSuccessResponse {
  success: true;
}

export type FeedbackSubmitResponse =
  | FeedbackSubmitSuccessResponse
  | ApiErrorResponse;

export interface FeedbackStatusSuccessResponse {
  success: true;
  submitted: boolean;
  rating: FeedbackRating | null;
}

export type FeedbackStatusResponse =
  | FeedbackStatusSuccessResponse
  | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Insights / admin
// ---------------------------------------------------------------------------

export interface ArticleHeatmapRow {
  article_reference: string;
  document_name: string;
  access_count: number;
  percentage: number;
}

export interface UsageStatsRow {
  total_analyses: number;
  total_chats: number;
  top_model: string | null;
  top_crime_category: string | null;
}

export interface AdminStatsResponse {
  success: true;
  generatedAt: string;
  totals: UsageStatsRow;
  perDay: Array<{ date: string; analyses: number; chats: number }>;
  byConfidence: Array<{ level: ConfidenceLevel; count: number }>;
  byModel: Array<{ modelId: string; count: number }>;
  byLanguage: Array<{ language: string; count: number }>;
  feedback: { up: number; down: number; recent: FeedbackComment[] };
}

export interface FeedbackComment {
  id: string;
  rating: FeedbackRating;
  comment: string | null;
  created_at: string;
}

export interface CacheStatsResponse {
  success: true;
  cachedEmbeddings: number;
  cachedAnalyses: number;
  estimatedRequestsSaved: number;
  estimatedCostSavedUsd: number;
}

// ---------------------------------------------------------------------------
// Lawyer directory
// ---------------------------------------------------------------------------

export type LegalResourceType =
  | "law_firm"
  | "legal_aid"
  | "bar_association"
  | "court";

export interface LegalResource {
  name: string;
  type: LegalResourceType;
  specializations: string[];
  city: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  languages: Language[];
  isFreeService: boolean;
  description: string;
}

// ---------------------------------------------------------------------------
// History page
// ---------------------------------------------------------------------------

export interface RecentConversationRow {
  id: string;
  scenario_description: string | null;
  first_user_message: string | null;
  model_id: string;
  confidence_level: ConfidenceLevel | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}
