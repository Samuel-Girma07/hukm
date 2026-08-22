-- ============================================================================
-- HUKM — Migration: analysis claim table for concurrent-duplicate dedupe
--             (idempotent)
--
-- /api/analyze previously ran cache-check → LLM call → persist with no
-- coordination, so two identical concurrent submissions (double-tap,
-- client retry, flaky network re-send) BOTH paid for an NVIDIA call and
-- BOTH inserted an analysis_results row.
--
-- Contract:
--   claim_analysis(key)            → 'claimed' (you own it) | 'lost'
--   resolve_analysis_claim(key,id) → winner records the result id
--   release_analysis_claim(key)    → loser/failure path frees the key so
--                                    the user can retry immediately.
-- Stale unresolved claims are purged lazily on every claim attempt.
-- ============================================================================

CREATE TABLE IF NOT EXISTS analysis_claims (
  claim_key TEXT PRIMARY KEY,
  result_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_claims_stale
  ON analysis_claims(created_at)
  WHERE result_id IS NULL;

CREATE OR REPLACE FUNCTION claim_analysis(
  p_key TEXT,
  p_ttl_seconds INT DEFAULT 90
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_won BOOLEAN;
BEGIN
  -- Lazy purge of abandoned claims (winner crashed before resolving).
  DELETE FROM analysis_claims
   WHERE result_id IS NULL
     AND created_at < now() - make_interval(secs => GREATEST(p_ttl_seconds, 5));

  WITH ins AS (
    INSERT INTO analysis_claims (claim_key) VALUES (p_key)
    ON CONFLICT (claim_key) DO NOTHING
    RETURNING claim_key
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_won;

  IF v_won THEN
    RETURN 'claimed';
  END IF;
  RETURN 'lost';
END;
$$;

CREATE OR REPLACE FUNCTION resolve_analysis_claim(
  p_key TEXT,
  p_result_id UUID
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE analysis_claims
     SET result_id = p_result_id
   WHERE claim_key = p_key;
$$;

CREATE OR REPLACE FUNCTION release_analysis_claim(p_key TEXT)
RETURNS VOID
LANGUAGE sql
AS $$
  DELETE FROM analysis_claims WHERE claim_key = p_key AND result_id IS NULL;
$$;
