-- ============================================================================
-- HUKM — Migration: share-link expiry and revocation
--             (shared_analyses.expires_at / revoked_at) — idempotent
--
-- Share links were previously permanent and irrevocable: anyone holding
-- the token could read the scenario + analysis forever. This migration
-- adds the two columns needed to bound that exposure:
--
--   • expires_at  — optional future cutoff (NULL = no expiry). The share
--     view APIs and page treat an expired link as not found.
--   • revoked_at  — set when the owner disables the link via
--     DELETE /api/share/[token]. Revocation is permanent.
--
-- Existing rows keep NULL for both → remain valid, matching today's
-- behavior until owners explicitly revoke them.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE shared_analyses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE shared_analyses ADD COLUMN IF NOT EXISTS revoked_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shared_analyses_token_live
  ON shared_analyses (share_token)
  WHERE revoked_at IS NULL;
