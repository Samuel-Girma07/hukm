-- ============================================================================
-- HUKM — Migration: users table + get_recent_conversations RPC
--             + conversations.updated_at trigger (idempotent)
--
-- Closes the deployment drift where two runtime-required objects existed
-- only outside the versioned migration set:
--
--   1. The `users` table lived only in lib/db/schema.sql, so a database
--      provisioned exclusively from migrations/ could not sign anyone up.
--   2. The `get_recent_conversations` RPC — consumed by GET /api/conversations
--      and the /history page — was never defined in this folder, producing
--      PGRST202 (function not found) on fresh databases.
--
-- Also introduces the missing write path for `conversations.updated_at`:
-- nothing in application code ever touched it, so history ordering silently
-- fell back to creation order forever.
--
-- Safe to re-run; every statement is IF NOT EXISTS / OR REPLACE and the
-- backfill only ever moves updated_at FORWARD.
-- ============================================================================

-- ---- users (custom JWT auth) ------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---- get_recent_conversations ----------------------------------------------
-- Shape contract (consumers):
--   • app/api/conversations/route.ts   GET  → ConversationListRow
--   • app/history/page.tsx             RPC  → RecentConversationRow
-- Columns MUST stay in this exact order/naming or PostgREST responses
-- will drift from the TypeScript types in lib/types.ts.
--
-- Changes vs the legacy definition:
--   • filters soft-deleted conversations (deleted_at IS NULL) so callers
--     no longer need a second query to hide them;
--   • default limit raised to 20 to match GET /api/conversations.

CREATE OR REPLACE FUNCTION get_recent_conversations(
  p_session_id TEXT,
  p_limit INT DEFAULT 20
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
)
LANGUAGE plpgsql
STABLE
AS $$
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
    AND c.deleted_at IS NULL
  GROUP BY c.id
  ORDER BY c.updated_at DESC
  LIMIT p_limit;
END;
$$;

-- ---- one-shot backfill (forward-only, re-run safe) --------------------------
-- Seed updated_at from the newest message so existing histories order by
-- real activity instead of creation date. Runs BEFORE the trigger below is
-- created so the seed value is not overwritten with the migration instant.
-- The `c.updated_at < …` guard makes re-running this migration a no-op once
-- the trigger owns the column (it can never move the timestamp backward).

UPDATE conversations c
SET updated_at = COALESCE(sub.max_created, c.created_at)
FROM (
  SELECT conversation_id, MAX(created_at) AS max_created
  FROM messages
  GROUP BY conversation_id
) sub
WHERE sub.conversation_id = c.id
  AND c.updated_at < COALESCE(sub.max_created, c.created_at);

-- ---- conversations.updated_at maintenance -----------------------------------
-- BEFORE UPDATE trigger so any row mutation (chat metadata updates, soft
-- deletes, future edits) refreshes the recency clock used for ordering.

CREATE OR REPLACE FUNCTION hukm_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_touch_updated_at ON conversations;
CREATE TRIGGER trg_conversations_touch_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION hukm_touch_updated_at();
