-- Migration: Add indexes to fix timeout issues
-- Run this in Supabase SQL Editor

-- Index for analysis_results (used by history page)
CREATE INDEX IF NOT EXISTS idx_analysis_results_session_created 
ON analysis_results(session_id, created_at DESC);

-- Index for shared_analyses (used by share API)
CREATE INDEX IF NOT EXISTS idx_shared_analyses_analysis_session 
ON shared_analyses(analysis_id, created_by_session);

-- Index for conversations (used by history)
CREATE INDEX IF NOT EXISTS idx_conversations_session_updated 
ON conversations(session_id, updated_at DESC);

-- Index for messages (used by chat)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

-- Index for article_access_log (used by heatmap)
CREATE INDEX IF NOT EXISTS idx_article_access_log_article 
ON article_access_log(analysis_id, article_reference);

-- Index for usage_events (used by admin stats)
CREATE INDEX IF NOT EXISTS idx_usage_events_created 
ON usage_events(created_at DESC);
