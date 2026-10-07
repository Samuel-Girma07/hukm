/**
 * HUKM — Model registry.
 *
 * Chat runs on Google Gemini Flash via the OpenAI-compatible endpoint
 * (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
 * see `scripts/probe-models.mjs`). Embeddings stay on NVIDIA Build
 * (`nvidia/nv-embedqa-e5-v5`, 1024-dim) so the pgvector store is untouched.
 *
 * Conventions:
 *   - `displayName` is the user-facing tier label (e.g. "Fast",
 *     "Balanced"). Users never see raw model names.
 *   - `tagline` is the one-line description under the label.
 *   - `modelName` / `contextLength` / `bestFor` are surfaced in the
 *     hover tooltip so power users know what is running.
 *   - `tier` drives rate limiting. `premium` models get a tighter
 *     ceiling (see `lib/ratelimit.ts`). All Flash models are standard.
 *   - `icon` drives the visual glyph in the picker (`speed` = lightning,
 *     `brain` = thinking depth).
 *   - `thinkingConfig` is legacy NVIDIA-only metadata. Google Flash
 *     models carry none; the field stays so old rows/tests referencing
 *     it keep compiling, but the chat client never sends it.
 *   - `PRIMARY_MODELS` is what users see in the selector.
 *   - `FALLBACK_MODELS` is the transparent retry chain — fast,
 *     reliable models that take over when the user's pick errors.
 */

// ---------------------------------------------------------------------------
// Embedding model
// ---------------------------------------------------------------------------

export const EMBEDDING = {
  modelId: "nvidia/nv-embedqa-e5-v5",
  endpoint: "https://integrate.api.nvidia.com/v1/embeddings",
  dimensions: 1024,
  inputType: {
    query: "query",
    passage: "passage",
  },
} as const;

// ---------------------------------------------------------------------------
// Chat models (Google Gemini Flash)
// ---------------------------------------------------------------------------

export const CHAT_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export type ModelTier = "premium" | "standard";

/** Vendor identifier — kept for internal tracking and admin surfaces. */
export type ModelVendor =
  | "google"
  | "nvidia"
  | "openai"
  | "meta"
  | "qwen"
  | "z-ai"
  | "deepseek";

/** Glyph used in the tier picker. */
export type ModelIcon = "speed" | "brain";

export interface ChatModel {
  id: string;
  /** User-facing tier label (e.g. "Fast", "Thinking low"). */
  displayName: string;
  /** One-line description shown under the label (~30–40 chars). */
  tagline: string;
  /** Actual model name surfaced in tooltip. */
  modelName: string;
  /** Context length surfaced in tooltip. */
  contextLength: string;
  /** Best use case surfaced in tooltip. */
  bestFor: string;
  /** Visual glyph in the picker. */
  icon: ModelIcon;
  /** Logo provider (internal / admin use). */
  vendor: ModelVendor;
  /** Rate-limit tier. */
  tier: ModelTier;
  /**
   * Legacy NVIDIA-only thinking configuration. Never sent to Google —
   * kept so persisted rows and old call sites keep their shape.
   */
  thinkingConfig?: {
    enable_thinking: boolean;
    lowEffort?: boolean;
  };
}

export const PRIMARY_MODELS: readonly ChatModel[] = [
  {
    id: "gemini-2.0-flash",
    displayName: "Fast",
    tagline: "Instant results, great for simple cases",
    modelName: "Gemini 2.0 Flash",
    contextLength: "1M",
    bestFor: "Quick checks, simple cases",
    icon: "speed",
    vendor: "google",
    tier: "standard",
  },
  {
    id: "gemini-2.5-flash",
    displayName: "Balanced",
    tagline: "Balanced speed and depth",
    modelName: "Gemini 2.5 Flash",
    contextLength: "1M",
    bestFor: "Most analyses",
    icon: "brain",
    vendor: "google",
    tier: "standard",
  },
  {
    id: "gemini-2.5-flash-lite",
    displayName: "Efficient",
    tagline: "Cheapest and fastest, lighter reasoning",
    modelName: "Gemini 2.5 Flash-Lite",
    contextLength: "1M",
    bestFor: "High-volume, simple cases",
    icon: "speed",
    vendor: "google",
    tier: "standard",
  },
] as const;

/**
 * Transparent fallback chain. When a primary call returns 5xx / 408 /
 * 429 the runtime walks this list in order. These are the fastest
 * confirmed-working models on the platform — picked for reliability,
 * not capability headroom.
 */
export const FALLBACK_MODELS: readonly ChatModel[] = [
  {
    id: "gemini-2.5-flash",
    displayName: "Balanced",
    tagline: "Balanced speed and depth",
    modelName: "Gemini 2.5 Flash",
    contextLength: "1M",
    bestFor: "Most analyses",
    icon: "brain",
    vendor: "google",
    tier: "standard",
  },
  {
    id: "gemini-2.0-flash",
    displayName: "Fast",
    tagline: "Instant results, great for simple cases",
    modelName: "Gemini 2.0 Flash",
    contextLength: "1M",
    bestFor: "Quick checks, simple cases",
    icon: "speed",
    vendor: "google",
    tier: "standard",
  },
  {
    id: "gemini-2.5-flash-lite",
    displayName: "Efficient",
    tagline: "Cheapest and fastest, lighter reasoning",
    modelName: "Gemini 2.5 Flash-Lite",
    contextLength: "1M",
    bestFor: "High-volume, simple cases",
    icon: "speed",
    vendor: "google",
    tier: "standard",
  },
] as const;

/**
 * Legacy NVIDIA-era model ids retired when chat moved to Google Flash.
 * Old clients (cached JS, saved curl snippets) and existing DB rows
 * (`conversations.model_id`, `analysis_results.model_id`) still carry
 * them. Resolve to the closest Flash equivalent instead of rejecting.
 */
export const LEGACY_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "nvidia/nemotron-3-super-120b-a12b": "gemini-2.0-flash",
  "moonshotai/kimi-k2.6": "gemini-2.5-flash",
  "qwen/qwen3-coder-480b-a35b-instruct": "gemini-2.5-flash",
  "meta/llama-4-maverick-17b-128e-instruct": "gemini-2.0-flash",
  "qwen/qwen3.5-122b-a10b": "gemini-2.5-flash",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5": "gemini-2.0-flash",
  "deepseek-ai/deepseek-v4-flash": "gemini-2.5-flash-lite",
  "openai/gpt-oss-20b": "gemini-2.5-flash-lite",
} as const;

/** Maps a possibly-retired id to the registered canonical id. */
export function resolveModelId(modelId: string): string {
  return LEGACY_MODEL_ALIASES[modelId] ?? modelId;
}

export const ALL_MODELS: readonly ChatModel[] = [
  ...PRIMARY_MODELS,
  ...FALLBACK_MODELS.filter(
    (fb) => !PRIMARY_MODELS.some((p) => p.id === fb.id),
  ),
];

/** Default: Balanced (best quality-to-speed ratio). */
export const DEFAULT_MODEL_ID = PRIMARY_MODELS[1]!.id;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isValidModelId(modelId: string): boolean {
  return ALL_MODELS.some((model) => model.id === resolveModelId(modelId));
}

export function getModel(modelId: string): ChatModel | undefined {
  return ALL_MODELS.find((model) => model.id === resolveModelId(modelId));
}

/** Returns the raw model display name (for admin / technical surfaces). */
export function getModelDisplayName(modelId: string): string {
  return getModel(modelId)?.modelName ?? modelId;
}

/** Returns the user-facing tier label (e.g. "Thinking low"). */
export function getModelTierLabel(modelId: string): string {
  return getModel(modelId)?.displayName ?? modelId;
}

/**
 * Returns the rate-limit tier for a model id. `premium` models are
 * the heavier or paid-tier ones (see `RATE_LIMITS` in
 * `lib/ratelimit.ts`); they get a tighter per-minute ceiling. Unknown
 * models fall back to `standard` so the system fails open.
 */
export function getModelTier(modelId: string): ModelTier {
  const explicit = getModel(modelId)?.tier;
  if (explicit) return explicit;
  // Defensive: if a model id slips through without metadata we still
  // treat the z-ai/* family as premium (paid endpoint historically).
  if (modelId.startsWith("z-ai/")) return "premium";
  return "standard";
}

/**
 * Returns the thinking configuration for a model id, if any.
 * Legacy NVIDIA-only hook — Google Flash models carry none, so this
 * is undefined for every registered model. Kept for shape compat.
 */
export function getModelThinkingConfig(
  modelId: string,
): { enable_thinking: boolean; lowEffort?: boolean } | undefined {
  return getModel(modelId)?.thinkingConfig;
}

/**
 * Returns the ordered fallback chain to attempt when the primary call
 * fails. Begins with the user's pick, then walks `FALLBACK_MODELS`,
 * skipping duplicates.
 */
export function getFallbackChain(requested: string): string[] {
  const resolved = resolveModelId(requested);
  const chain: string[] = [resolved];
  for (const m of FALLBACK_MODELS) {
    if (!chain.includes(m.id)) chain.push(m.id);
  }
  return chain;
}
