/**
 * HUKM — Model registry.
 *
 * Single source of truth for every NVIDIA Build model id used by the
 * app. The roster below was probed live against
 * `https://integrate.api.nvidia.com/v1/chat/completions` (see
 * `scripts/probe-models.mjs`) — every entry returned 200 OK with a
 * latency we measured at the time of the probe.
 *
 * Conventions:
 *   - `displayName` is the user-facing tier label (e.g. "Fast",
 *     "Thinking low"). Users never see raw model names.
 *   - `tagline` is the one-line description under the label.
 *   - `modelName` / `contextLength` / `bestFor` are surfaced in the
 *     hover tooltip so power users know what is running.
 *   - `tier` drives rate limiting. `premium` models get a tighter
 *     ceiling (see `lib/ratelimit.ts`).
 *   - `icon` drives the visual glyph in the picker (`speed` = lightning,
 *     `brain` = thinking depth).
 *   - `thinkingConfig` is injected into the NVIDIA request body when
 *     present (replaces the old hard-coded `z-ai/` prefix check).
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
// Chat models
// ---------------------------------------------------------------------------

export const CHAT_ENDPOINT =
  "https://integrate.api.nvidia.com/v1/chat/completions";

export type ModelTier = "premium" | "standard";

/** Vendor identifier — kept for internal tracking and admin surfaces. */
export type ModelVendor =
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
  /** Per-model NVIDIA API thinking configuration (injected into request body). */
  thinkingConfig?: {
    enable_thinking: boolean;
    lowEffort?: boolean;
  };
}

export const PRIMARY_MODELS: readonly ChatModel[] = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    displayName: "Fast",
    tagline: "Instant results, great for simple cases",
    modelName: "Nemotron Super 120B",
    contextLength: "128K",
    bestFor: "Quick checks, simple cases",
    icon: "speed",
    vendor: "nvidia",
    tier: "standard",
  },
  {
    id: "moonshotai/kimi-k2.6",
    displayName: "Balanced",
    tagline: "Balanced speed and depth",
    modelName: "Kimi k2.6",
    contextLength: "128K",
    bestFor: "Most analyses",
    icon: "brain",
    vendor: "z-ai",
    tier: "standard",
  },
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    displayName: "Thinking high",
    tagline: "Maximum reasoning depth",
    modelName: "Qwen3 Coder 480B",
    contextLength: "128K",
    bestFor: "Critical cases",
    icon: "brain",
    vendor: "qwen",
    tier: "premium",
    thinkingConfig: { enable_thinking: false },
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
    id: "meta/llama-4-maverick-17b-128e-instruct",
    displayName: "Fast",
    tagline: "Instant results, great for simple cases",
    modelName: "Llama 4 Maverick 17B MoE",
    contextLength: "128K",
    bestFor: "Quick checks, simple cases",
    icon: "speed",
    vendor: "meta",
    tier: "standard",
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    displayName: "Thinking low",
    tagline: "Deep analysis, best quality-to-speed ratio",
    modelName: "Qwen3.5 122B",
    contextLength: "128K",
    bestFor: "Most analyses",
    icon: "brain",
    vendor: "qwen",
    tier: "standard",
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    displayName: "Fast thinking",
    tagline: "Fast with reasoning",
    modelName: "Nemotron Super 49B",
    contextLength: "128K",
    bestFor: "Balanced speed and depth",
    icon: "speed",
    vendor: "nvidia",
    tier: "standard",
  },
  {
    id: "deepseek-ai/deepseek-v4-flash",
    displayName: "Fast",
    tagline: "Instant results, great for simple cases",
    modelName: "DeepSeek V4 Flash",
    contextLength: "128K",
    bestFor: "Quick checks, simple cases",
    icon: "speed",
    vendor: "deepseek",
    tier: "standard",
  },
  {
    id: "openai/gpt-oss-20b",
    displayName: "Thinking low",
    tagline: "Deep analysis, best quality-to-speed ratio",
    modelName: "GPT-OSS 20B",
    contextLength: "128K",
    bestFor: "Most analyses",
    icon: "brain",
    vendor: "openai",
    tier: "standard",
  },
] as const;

export const ALL_MODELS: readonly ChatModel[] = [
  ...PRIMARY_MODELS,
  ...FALLBACK_MODELS.filter(
    (fb) => !PRIMARY_MODELS.some((p) => p.id === fb.id),
  ),
];

/** Default: Thinking low (best quality-to-speed ratio). */
export const DEFAULT_MODEL_ID = PRIMARY_MODELS[1]!.id;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isValidModelId(modelId: string): boolean {
  return ALL_MODELS.some((model) => model.id === modelId);
}

export function getModel(modelId: string): ChatModel | undefined {
  return ALL_MODELS.find((model) => model.id === modelId);
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
 * Used by `lib/nvidia.ts` to inject `chat_template_kwargs`.
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
  const chain: string[] = [requested];
  for (const m of FALLBACK_MODELS) {
    if (!chain.includes(m.id)) chain.push(m.id);
  }
  return chain;
}
