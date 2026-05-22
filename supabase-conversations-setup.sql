-- ============================================================================
-- HUKM — Conversation + Analysis Persistence + RLS
--
-- This migration is IDEMPOTENT. Running it multiple times never drops
-- application data; it only creates missing objects and refreshes the
-- RLS policies and helper functions.
--
-- Tables:
--   - conversations       (multi-turn chat sessions)
--   - messages            (individual messages inside conversations)
--   - analysis_results    (persisted single-shot analysis results so the
--                          /results/[id] page survives a refresh)
--
-- Run this in the Supabase SQL editor (or via scripts/apply_migration.ts).
-- ============================================================================

-- ---- conversations ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  scenario_description TEXT,
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence_level TEXT,
  is_civil_matter BOOLEAN DEFAULT FALSE,
  needs_clarification BOOLEAN DEFAULT FALSE,
  CONSTRAINT conversations_session_id_check CHECK (session_id != '')
);

CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_session_updated
  ON conversations(session_id, updated_at DESC);

-- ---- messages --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created
  ON messages(conversation_id, created_at ASC);

-- ---- analysis_results ------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  scenario_input JSONB NOT NULL,
  result JSONB NOT NULL,
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analysis_results_session_id_check CHECK (session_id != '')
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_session
  ON analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created
  ON analysis_results(created_at DESC);

-- ============================================================================
-- updated_at triggers
--
-- Two triggers cooperate so `conversations.updated_at` reflects last activity:
--   1. Direct UPDATEs on `conversations` set updated_at = NOW()
--   2. INSERTs into `messages` bump the parent conversation's updated_at
--      (otherwise the column would be stuck at created_at because the message
--      table is the only thing that changes during normal use).
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

-- ============================================================================
-- Row Level Security (locked down)
-- The browser only ever talks to /api/* (no direct Supabase reads). The
-- service role bypasses RLS, so we deny everything to anon/authenticated
-- and rely on API-route ownership checks.
-- ============================================================================

ALTER TABLE conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- conversations
DROP POLICY IF EXISTS "Allow all operations for now"     ON conversations;
DROP POLICY IF EXISTS "Service role only - conversations" ON conversations;
CREATE POLICY "Service role only - conversations"
  ON conversations
  FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

-- messages
DROP POLICY IF EXISTS "Allow all operations for now"  ON messages;
DROP POLICY IF EXISTS "Service role only - messages"  ON messages;
CREATE POLICY "Service role only - messages"
  ON messages
  FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

-- analysis_results
DROP POLICY IF EXISTS "Allow all operations for now"          ON analysis_results;
DROP POLICY IF EXISTS "Service role only - analysis_results"  ON analysis_results;
CREATE POLICY "Service role only - analysis_results"
  ON analysis_results
  FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

-- ============================================================================
-- Helper functions
-- ============================================================================

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
    -- Fall-back preview: first user message in the conversation. This is
    -- shown by the UI when scenario_description is empty (e.g. legacy
    -- "(empty scenario)" rows).
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

CREATE OR REPLACE FUNCTION get_conversation_messages(
  p_conversation_id UUID
)
RETURNS TABLE(
  id UUID,
  role TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.role,
    m.content,
    m.metadata,
    m.created_at
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
  ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification
-- ============================================================================
-- After running, expect:
--   SELECT COUNT(*) FROM conversations;     -- existing rows preserved
--   SELECT COUNT(*) FROM messages;          -- existing rows preserved
--   SELECT COUNT(*) FROM analysis_results;  -- 0 (new table)
-- ============================================================================
