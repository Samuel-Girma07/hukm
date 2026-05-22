-- ============================================================================
-- HUKM — Base schema (migration 001, idempotent)
--
-- Creates the core tables that the application needs:
--   • law_chunks      – the RAG vector store
--   • analysis_results – stores every AI analysis
--   • conversations   – chat sessions
--   • messages        – individual chat messages
--
-- Run this FIRST in the Supabase SQL editor, then run
-- migrations/002_advanced_features.sql.
-- ============================================================================

-- Enable pgvector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- ---- law_chunks (RAG vector store) -----------------------------------------
CREATE TABLE IF NOT EXISTS law_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_name     TEXT NOT NULL,
  article_reference TEXT NOT NULL,
  content           TEXT NOT NULL,
  embedding         VECTOR(1024),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_chunks_document
  ON law_chunks(document_name);

-- NOTE: Do NOT create a vector index on an empty table.
-- Once law_chunks has data, run this in the SQL editor:
--   CREATE INDEX idx_law_chunks_embedding
--     ON law_chunks USING hnsw (embedding vector_cosine_ops);
-- (HNSW works on any plan; IVFFlat needs maintenance_work_mem > 32 MB)

-- RPC used by the retrieval pipeline
DROP FUNCTION IF EXISTS match_law_chunks(vector, double precision, integer);
CREATE OR REPLACE FUNCTION match_law_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count     INT
)
RETURNS TABLE (
  id                BIGINT,
  document_name     TEXT,
  article_reference TEXT,
  content           TEXT,
  similarity        FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    lc.id,
    lc.document_name,
    lc.article_reference,
    lc.content,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM law_chunks lc
  WHERE 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---- analysis_results -------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     TEXT NOT NULL,
  scenario_input JSONB NOT NULL,
  result         JSONB NOT NULL,
  model_id       TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_session
  ON analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created
  ON analysis_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_model
  ON analysis_results(model_id);

-- ---- conversations ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           TEXT NOT NULL,
  user_id              TEXT,
  scenario_description TEXT,
  model_id             TEXT NOT NULL,
  confidence_level     TEXT,
  is_civil_matter      BOOLEAN NOT NULL DEFAULT false,
  needs_clarification  BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created
  ON conversations(created_at DESC);

-- ---- messages ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created
  ON messages(created_at);

-- ---- RLS -------------------------------------------------------------------
-- All tables are accessed server-side only via the service role key.
-- Lock them down so the anon / authenticated roles cannot touch them.

ALTER TABLE law_chunks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only - law_chunks"       ON law_chunks;
DROP POLICY IF EXISTS "service role only - analysis_results" ON analysis_results;
DROP POLICY IF EXISTS "service role only - conversations"    ON conversations;
DROP POLICY IF EXISTS "service role only - messages"         ON messages;

CREATE POLICY "service role only - law_chunks"
  ON law_chunks FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - analysis_results"
  ON analysis_results FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - conversations"
  ON conversations FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - messages"
  ON messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
