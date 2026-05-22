-- Migration: Add retrieval_stats to analysis_results
-- Run this in Supabase SQL Editor

ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS retrieval_stats JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN analysis_results.retrieval_stats IS 
  'Structured retrieval statistics for confidence calibration: {strongCount, moderateCount, weakCount, maxSimilarity, hasPunishment, hasCriminalCode, stage, chunkCount}';
