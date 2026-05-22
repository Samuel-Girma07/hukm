-- ============================================================================
-- HUKM — Advanced features migration (idempotent)
--
-- Adds the supporting tables for: feedback, embedding/analysis caches,
-- article access logging, usage analytics, shareable analyses, soft-deletes
-- for conversations, plus two read-only RPCs for the admin dashboard.
--
-- Safe to re-run; every CREATE / ALTER uses IF NOT EXISTS, every CREATE
-- OR REPLACE for the functions.
-- ============================================================================

-- ---- feedback --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating IN (1, -1)),
  comment TEXT CHECK (char_length(comment) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (analysis_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_analysis ON feedback(analysis_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback(session_id);

-- ---- cached_embeddings -----------------------------------------------------
CREATE TABLE IF NOT EXISTS cached_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT UNIQUE NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cached_embeddings_created
  ON cached_embeddings(created_at DESC);

-- ---- cached_analyses -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cached_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_hash TEXT UNIQUE NOT NULL,
  result_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cached_analyses_created
  ON cached_analyses(created_at DESC);

-- ---- article_access_log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS article_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_reference TEXT NOT NULL,
  document_name TEXT NOT NULL,
  analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
  similarity FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_access_log_article
  ON article_access_log(article_reference);
CREATE INDEX IF NOT EXISTS idx_article_access_log_created
  ON article_access_log(created_at DESC);

-- ---- usage_events ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  model_id TEXT,
  crime_category TEXT,
  confidence_level TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_type
  ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created
  ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_session
  ON usage_events(session_id);

-- ---- shared_analyses -------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token TEXT UNIQUE NOT NULL,
  analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
  created_by_session TEXT NOT NULL,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_analyses_token
  ON shared_analyses(share_token);

-- ---- soft delete on conversations ------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
  ON conversations(deleted_at);

-- ---- RLS ------------------------------------------------------------------
-- Lock the new tables down to the service role. The application layer (which
-- uses the service role key) is the only thing that ever reads or writes
-- these tables, and we already enforce ownership in the API routes.

ALTER TABLE feedback           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_embeddings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_analyses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_analyses    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only - feedback"           ON feedback;
DROP POLICY IF EXISTS "service role only - cached_embeddings"  ON cached_embeddings;
DROP POLICY IF EXISTS "service role only - cached_analyses"    ON cached_analyses;
DROP POLICY IF EXISTS "service role only - article_access_log" ON article_access_log;
DROP POLICY IF EXISTS "service role only - usage_events"       ON usage_events;
DROP POLICY IF EXISTS "service role only - shared_analyses"    ON shared_analyses;

CREATE POLICY "service role only - feedback"
  ON feedback FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - cached_embeddings"
  ON cached_embeddings FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - cached_analyses"
  ON cached_analyses FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - article_access_log"
  ON article_access_log FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - usage_events"
  ON usage_events FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "service role only - shared_analyses"
  ON shared_analyses FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- ============================================================================
-- Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_article_heatmap(p_limit INT)
RETURNS TABLE (
  article_reference TEXT,
  document_name TEXT,
  access_count BIGINT
)
LANGUAGE sql
AS $$
  SELECT article_reference, document_name, COUNT(*)::BIGINT AS access_count
  FROM article_access_log
  GROUP BY article_reference, document_name
  ORDER BY access_count DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION get_usage_stats()
RETURNS TABLE (
  total_analyses BIGINT,
  total_chats BIGINT,
  top_model TEXT,
  top_crime_category TEXT
)
LANGUAGE sql
AS $$
  SELECT
    (SELECT COUNT(*)::BIGINT FROM usage_events WHERE event_type = 'analyze'),
    (SELECT COUNT(*)::BIGINT FROM usage_events WHERE event_type = 'chat'),
    (
      SELECT model_id FROM usage_events
       WHERE model_id IS NOT NULL
       GROUP BY model_id
       ORDER BY COUNT(*) DESC
       LIMIT 1
    ),
    (
      SELECT crime_category FROM usage_events
       WHERE crime_category IS NOT NULL
       GROUP BY crime_category
       ORDER BY COUNT(*) DESC
       LIMIT 1
    );
$$;
