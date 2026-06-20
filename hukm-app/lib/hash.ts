/**
 * HUKM — Hash helpers used for caching and session anonymisation.
 *
 * Pure functions; safe to import from any environment. Uses Node's
 * `crypto` (works in the Node.js runtime; for edge runtime, swap to the
 * Web Crypto SubtleCrypto digest — none of our routes run on edge).
 */

import { createHash } from "crypto";

/**
 * Normalises a scenario string for cache keying:
 * lowercases, trims, collapses whitespace, removes punctuation. Two
 * scenarios that differ only in capitalisation/whitespace map to the
 * same key.
 */
export function normaliseScenario(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashScenario(input: string): string {
  return createHash("sha256")
    .update(normaliseScenario(input), "utf8")
    .digest("hex");
}

export function hashEmbeddingInput(input: string): string {
  return createHash("sha256").update(input.trim(), "utf8").digest("hex");
}

/**
 * Anonymising hash for a session id used in logs and Sentry user tags.
 * Returns the first 16 hex characters of sha256 — enough to correlate
 * across log lines without leaking the real session id.
 * Accepts null (returns "anonymous") so callers that have already
 * null-checked don't need to repeat the check.
 */
export function hashSession(sessionId: string | null | undefined): string {
  if (!sessionId) return "anonymous";
  return createHash("sha256").update(sessionId, "utf8").digest("hex").slice(0, 16);
}

/**
 * Generic SHA-256 helper — used by the admin login flow to compare a
 * client-side hash of the entered password against the digest of
 * `ADMIN_PASSWORD`.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
