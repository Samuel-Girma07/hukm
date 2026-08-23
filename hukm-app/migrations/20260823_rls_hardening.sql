-- ============================================================================
-- HUKM — Migration: enable Row Level Security on the remaining tables
--             (users, analysis_claims) — idempotent
--
-- Closes a defense-in-depth gap: every other table (law_chunks,
-- analysis_results, conversations, messages, feedback, cached_*,
-- usage_events, shared_analyses, article_access_log) already had RLS
-- enabled by 001/002, but the tables created later did not.
--
--   • users           — stores bcrypt password hashes. If the Supabase
--                       anon key were ever usable against this table,
--                       hashes would be readable. With RLS enabled and no
--                       policies, anon/authenticated roles are denied.
--   • analysis_claims — internal dedupe bookkeeping; no client should
--                       ever read or write it directly.
--
-- The application always connects with the service-role key (lib/supabase.ts)
-- or a direct Postgres connection (lib/db/userQuery.ts), both of which
-- BYPASS RLS — so app behavior is unchanged. This only locks out direct
-- anon-key access via the Supabase Data API.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_claims ENABLE ROW LEVEL SECURITY;
