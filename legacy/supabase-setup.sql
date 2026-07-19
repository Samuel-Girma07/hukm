-- ============================================================================
-- HUKM — ETHIOPIAN SENTENCING ASSISTANT
-- Supabase Vector Database Setup Script (1024 dimensions)
-- ============================================================================
--
-- INSTRUCTIONS:
-- 1. Open your Supabase project dashboard at https://supabase.com
-- 2. Go to the SQL Editor (left sidebar > SQL Editor)
-- 3. Click "New Query"
-- 4. Copy and paste this ENTIRE file into the query editor
-- 5. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
--
-- This script will:
-- - Enable the pgvector extension
-- - Create the law_chunks table for storing embedded law articles
-- - Create an ivfflat index for fast similarity search
-- - Create the match_law_chunks function for querying similar chunks
--
-- Run this ONCE before running the ingestion script (scripts/ingest.py)
-- 
-- NOTE: Uses 1024-dimensional vectors for nvidia/nv-embedqa-e5-v5
-- ============================================================================

-- IMPORTANT: This script is now IDEMPOTENT and SAFE to re-run.
-- Earlier versions DROP TABLE'd law_chunks at the top, which would wipe all
-- ingested embeddings. That destructive line is removed; we only ever CREATE
-- IF NOT EXISTS or CREATE OR REPLACE here. Use scripts/cleanup_garbage_chunks.ts
-- if you need to delete bad chunks.

-- Step 1: Enable the pgvector extension
-- This provides the vector data type and similarity search functions
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the law_chunks table
-- This table stores individual law article chunks with their embeddings
CREATE TABLE IF NOT EXISTS law_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL,           -- e.g., 'criminal-code-414-2004'
  article_reference TEXT,                 -- e.g., 'Article 688 — Robbery with Violence'
  content TEXT NOT NULL,                  -- The actual law text of this chunk
  metadata JSONB,                         -- Source, proclamation number, year, page number, etc.
  embedding VECTOR(1024) NOT NULL         -- 1024-dimensional embedding from NVIDIA
);

-- Step 3: Create an ivfflat index on the embedding column for fast similarity search
-- ivfflat works well for vectors up to 1024 dimensions
-- This makes retrieval much faster than sequential scan
CREATE INDEX IF NOT EXISTS law_chunks_embedding_idx
ON law_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Create the match_law_chunks function
-- This function performs similarity search and returns the most relevant law chunks.
--
-- Parameters:
--   query_embedding: The 1024-dimensional vector of the search query
--   match_threshold: Minimum similarity score (default 0.3 — matches the
--                    threshold the application passes; the previous default
--                    of 0.5 made direct RPC callers under-retrieve)
--   match_count:    Maximum number of results to return (default 8)
--
-- The function bumps `ivfflat.probes` from 1 to 10 inside its session so
-- the ANN search inspects a wider candidate set. With `lists = 100` and
-- ~14k rows this trades a few ms of latency for materially better recall.
--
-- Returns:
--   Table with id, document_name, article_reference, content, metadata, similarity
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
  -- Wider ivfflat search so we don't miss matches that fall outside the
  -- single nearest centroid. Scoped to this function call only.
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

-- ============================================================================
-- VERIFICATION (Optional)
-- After running this script, you can verify the setup with:
--
-- SELECT COUNT(*) FROM law_chunks;  -- Should return 0 before ingestion
--
-- After running the ingestion script, test retrieval with:
-- SELECT * FROM match_law_chunks(
--   '[0.1, 0.2, ...]'::vector(1024),  -- Replace with actual test vector
--   0.5,
--   8
-- );
-- ============================================================================
