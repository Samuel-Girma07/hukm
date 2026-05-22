import { describe, it, expect } from "vitest";
import {
  isValidModelId,
  getChatModelById,
  getDisplayName,
  ALL_CHAT_MODELS,
  PRIMARY_MODELS,
  FALLBACK_MODELS,
  DEFAULT_MODEL_ID,
  EMBEDDING_MODEL_ID,
  EMBEDDING_DIMENSIONS,
} from "../lib/models";

describe("Model Registry", () => {
  describe("constants", () => {
    it("has a valid default model ID", () => {
      expect(DEFAULT_MODEL_ID).toBe("z-ai/glm4.7");
    });

    it("has primary and fallback models", () => {
      expect(PRIMARY_MODELS.length).toBeGreaterThan(0);
      expect(FALLBACK_MODELS.length).toBeGreaterThan(0);
    });

    it("combines primary and fallback into ALL_CHAT_MODELS", () => {
      expect(ALL_CHAT_MODELS.length).toBe(
        PRIMARY_MODELS.length + FALLBACK_MODELS.length
      );
    });

    it("has embedding model configured", () => {
      expect(EMBEDDING_MODEL_ID).toBe("nvidia/nv-embedqa-e5-v5");
      expect(EMBEDDING_DIMENSIONS).toBe(1024);
    });

    it("default model is in primary models", () => {
      const found = PRIMARY_MODELS.find((m) => m.id === DEFAULT_MODEL_ID);
      expect(found).toBeDefined();
    });
  });

  describe("isValidModelId", () => {
    it("returns true for valid primary model", () => {
      expect(isValidModelId("z-ai/glm4.7")).toBe(true);
    });

    it("returns true for valid fallback model", () => {
      expect(isValidModelId("meta/llama-3.3-70b-instruct")).toBe(true);
    });

    it("returns false for invalid model", () => {
      expect(isValidModelId("fake/model")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidModelId("")).toBe(false);
    });
  });

  describe("getChatModelById", () => {
    it("returns model for valid ID", () => {
      const model = getChatModelById("z-ai/glm4.7");
      expect(model).toBeDefined();
      expect(model?.displayName).toContain("GLM-4.7");
      expect(model?.tier).toBe("primary");
    });

    it("returns undefined for invalid ID", () => {
      expect(getChatModelById("fake/model")).toBeUndefined();
    });
  });

  describe("getDisplayName", () => {
    it("returns display name for valid model", () => {
      const name = getDisplayName("z-ai/glm4.7");
      expect(name).toContain("GLM-4.7");
    });

    it("returns model ID itself for unknown model", () => {
      expect(getDisplayName("unknown/model")).toBe("unknown/model");
    });
  });

  describe("model structure", () => {
    it("all models have required fields", () => {
      for (const model of ALL_CHAT_MODELS) {
        expect(model.id).toBeTruthy();
        expect(model.displayName).toBeTruthy();
        expect(["primary", "fallback"]).toContain(model.tier);
      }
    });

    it("all model IDs are unique", () => {
      const ids = ALL_CHAT_MODELS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
