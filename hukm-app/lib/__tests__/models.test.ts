/**
 * Unit tests for lib/models.ts — registry invariants the runtime relies
 * on: unique ids, valid default, fallback chain shape, tier mapping.
 */

import { describe, expect, it } from "vitest";

import {
  ALL_MODELS,
  DEFAULT_MODEL_ID,
  FALLBACK_MODELS,
  PRIMARY_MODELS,
  EMBEDDING,
  getFallbackChain,
  getModel,
  getModelThinkingConfig,
  getModelTier,
  isValidModelId,
} from "../models";

describe("model registry", () => {
  it("has no duplicate model ids across primary and fallback rosters", () => {
    const ids = ALL_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers every primary and fallback model in ALL_MODELS", () => {
    for (const m of [...PRIMARY_MODELS, ...FALLBACK_MODELS]) {
      expect(getModel(m.id)).toBeDefined();
      expect(isValidModelId(m.id)).toBe(true);
    }
  });

  it("exposes a valid default model", () => {
    expect(isValidModelId(DEFAULT_MODEL_ID)).toBe(true);
    expect(PRIMARY_MODELS.some((p) => p.id === DEFAULT_MODEL_ID)).toBe(true);
  });

  it("gives every model a non-empty display surface", () => {
    for (const m of ALL_MODELS) {
      expect(m.displayName.trim().length).toBeGreaterThan(0);
      expect(m.modelName.trim().length).toBeGreaterThan(0);
      expect(["speed", "brain"]).toContain(m.icon);
      expect(["standard", "premium"]).toContain(m.tier);
    }
  });
});

describe("getFallbackChain", () => {
  it("starts with the requested model and dedupes against fallbacks", () => {
    const requested = PRIMARY_MODELS[0]!.id;
    const chain = getFallbackChain(requested);
    expect(chain[0]).toBe(requested);
    expect(new Set(chain).size).toBe(chain.length);
    // Every entry must be a registered model.
    for (const id of chain) expect(isValidModelId(id)).toBe(true);
  });

  it("contains at least one alternative after the requested model", () => {
    const chain = getFallbackChain(DEFAULT_MODEL_ID);
    expect(chain.length).toBeGreaterThan(1);
  });

  it("matches FALLBACK_MODELS length when requesting an unregistered-but-primary id", () => {
    // Requested first + all fallbacks (minus any dupes) is the ceiling.
    const chain = getFallbackChain(PRIMARY_MODELS[2]!.id);
    expect(chain.length).toBeLessThanOrEqual(FALLBACK_MODELS.length + 1);
  });
});

describe("getModelTier", () => {
  it("maps premium-tier models correctly", () => {
    const premium = ALL_MODELS.find((m) => m.tier === "premium");
    if (premium) expect(getModelTier(premium.id)).toBe("premium");
  });

  it("treats unknown models as standard (fail-open) but keeps z-ai/* premium", () => {
    expect(getModelTier("totally/unknown-model")).toBe("standard");
    expect(getModelTier("z-ai/legacy-glm")).toBe("premium");
  });
});

describe("getModelThinkingConfig / EMBEDDING", () => {
  it("returns undefined for models without thinking config", () => {
    const plain = ALL_MODELS.find((m) => !m.thinkingConfig);
    if (plain) expect(getModelThinkingConfig(plain.id)).toBeUndefined();
  });

  it("keeps embedding metadata consistent with the retrieval contract", () => {
    expect(EMBEDDING.dimensions).toBe(1024);
    expect(EMBEDDING.endpoint).toContain("/v1/embeddings");
  });
});
