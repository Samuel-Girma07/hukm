-- ============================================================================
-- HUKM — Migration v2
--
-- Run this against an EXISTING Supabase project that already has the v1
-- tables (`law_chunks`, `conversations`, `messages`, `analysis_results`).
--
-- For a fresh install you don't need this file — just run
--   supabase-setup.sql + supabase-conversations-setup.sql
-- which already contain everything below.
--
-- This migration:
--   1. Bumps `match_law_chunks` defaults (threshold 0.3, ivfflat.probes 10)
--      to materially improve recall.
--   2. Adds an AFTER INSERT trigger on `messages` that bumps the parent
--      conversation's `updated_at`, so the conversation list sorts by
--      actual activity instead of creation time.
--
-- IDEMPOTENT: re-running it never drops data; only refreshes function
-- bodies and trigger definitions.
-- ============================================================================

-- ---- 1. Improved match_law_chunks ------------------------------------------
CREATE OR REPLACE FUNCTION match_law_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 8
)
RETURNS TABLE(
  id BIGINT,
  document_name TEXT,
  article_reference TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('ivfflat.probes', '10', true);

  RETURN QUERY
  SELECT
    lc.id,
    lc.document_name,
    lc.article_reference,
    lc.content,
    lc.metadata,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM law_chunks lc
  WHERE 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ---- 2. messages -> conversations.updated_at trigger -----------------------
CREATE OR REPLACE FUNCTION touch_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
     SET updated_at = NOW()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_touch_conversation_updated_at ON messages;
CREATE TRIGGER messages_touch_conversation_updated_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_conversation_updated_at();

-- ---- 3. get_recent_conversations now returns first_user_message ------------
-- The conversations list page falls back to this when scenario_description
-- is empty so legacy "(empty scenario)" rows still get a useful preview.
CREATE OR REPLACE FUNCTION get_recent_conversations(
  p_session_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  scenario_description TEXT,
  first_user_message TEXT,
  model_id TEXT,
  confidence_level TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  message_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.scenario_description,
    (
      SELECT m2.content
      FROM messages m2
      WHERE m2.conversation_id = c.id AND m2.role = 'user'
      ORDER BY m2.created_at ASC
      LIMIT 1
    ) AS first_user_message,
    c.model_id,
    c.confidence_level,
    c.created_at,
    c.updated_at,
    COUNT(m.id)::BIGINT AS message_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.session_id = p_session_id
  GROUP BY c.id
  ORDER BY c.updated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ---- Verification ----------------------------------------------------------
-- After running, expect:
--   SELECT proname, pronargs FROM pg_proc WHERE proname = 'match_law_chunks';
--     -> 1 row, pronargs = 3
--   SELECT tgname FROM pg_trigger
--    WHERE tgname = 'messages_touch_conversation_updated_at';
--     -> 1 row
-- ============================================================================
