-- HUKM — Migration: atomic view count increment for shared analyses
-- Fixes the read-then-write race in /api/share/[token] where concurrent
-- viewers all read the same view_count, compute +1, and overwrite.
--
-- This function does a single atomic UPDATE ... SET view_count = view_count + 1
-- and returns the new value. Callers use it via supabase.rpc().

CREATE OR REPLACE FUNCTION increment_share_view_count(p_token TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE shared_analyses
     SET view_count = COALESCE(view_count, 0) + 1
   WHERE share_token = p_token
  RETURNING view_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION increment_share_view_count IS
  'Atomically increments the view_count of a shared analysis identified by
   its share_token. Returns the new view_count, or NULL if the token does
   not exist. SECURITY DEFINER so it works even if RLS would block direct
   UPDATE on shared_analyses.';
