/**
 * HUKM — Model and Embedding Registry
 *
 * Central configuration for all AI models and embeddings used in the application.
 * Never hardcode model IDs outside this file.
 */

// ============================================================================
// EMBEDDING MODEL CONFIGURATION
// ============================================================================

// Using nvidia/nv-embedqa-e5-v5 which returns 1024-dimensional vectors
// This is compatible with all pgvector index types (ivfflat and HNSW)
export const EMBEDDING_MODEL_ID = "nvidia/nv-embedqa-e5-v5";
export const EMBEDDING_ENDPOINT =
  "https://integrate.api.nvidia.com/v1/embeddings";
export const EMBEDDING_DIMENSIONS = 1024; // This model returns 1024-dimensional vectors
export const EMBEDDING_INPUT_TYPE_PASSAGE = "passage";
export const EMBEDDING_INPUT_TYPE_QUERY = "query";

// ============================================================================
// CHAT MODEL CONFIGURATION
// ============================================================================

export type ModelTier = "primary" | "fallback";

export interface ChatModel {
  id: string;
  displayName: string;
  tier: ModelTier;
  note?: string;
}

// Primary chat models
export const PRIMARY_MODELS: ChatModel[] = [
  {
    id: "z-ai/glm5",
    displayName: "GLM-5 (Best — 744B MoE, 205K context)",
    tier: "primary",
    note: "Requires paid NVIDIA hosting",
  },
  {
    id: "z-ai/glm4.7",
    displayName: "GLM-4.7 (Recommended — Free endpoint, 131K context)",
    tier: "primary",
  },
];

// Fallback chat models
export const FALLBACK_MODELS: ChatModel[] = [
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    displayName: "Llama 4 Maverick (Meta, MoE, strong reasoning)",
    tier: "fallback",
  },
  {
    id: "meta/llama-3.1-405b-instruct",
    displayName: "Llama 3.1 405B (Meta, heaviest, strongest)",
    tier: "fallback",
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    displayName: "Llama 3.3 70B (Meta, multilingual, 128K context)",
    tier: "fallback",
  },
  {
    id: "deepseek-ai/deepseek-v3.2",
    displayName: "DeepSeek V3.2 (685B MoE, top reasoning)",
    tier: "fallback",
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    displayName: "Mistral Large 3 (675B, multilingual)",
    tier: "fallback",
  },
];

// All chat models combined
export const ALL_CHAT_MODELS: ChatModel[] = [
  ...PRIMARY_MODELS,
  ...FALLBACK_MODELS,
];

// Default model (pre-selected in dropdown)
export const DEFAULT_MODEL_ID = "z-ai/glm4.7";

// Chat completions endpoint
export const CHAT_ENDPOINT =
  "https://integrate.api.nvidia.com/v1/chat/completions";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates if a model ID exists in the registry
 * @param modelId - The model ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidModelId(modelId: string): boolean {
  return ALL_CHAT_MODELS.some((model) => model.id === modelId);
}

/**
 * Gets a chat model by ID
 * @param modelId - The model ID to look up
 * @returns The ChatModel object or undefined if not found
 */
export function getChatModelById(modelId: string): ChatModel | undefined {
  return ALL_CHAT_MODELS.find((model) => model.id === modelId);
}

/**
 * Gets the display name for a model ID
 * @param modelId - The model ID to get display name for
 * @returns The display name or the model ID if not found
 */
export function getDisplayName(modelId: string): string {
  return getChatModelById(modelId)?.displayName ?? modelId;
}
