/**
 * HUKM — Supabase / PostgREST error helpers.
 *
 * The most common deployment-time failure is "table not found in schema
 * cache" (PGRST205) which happens when migrations have not been applied
 * to the live database. We surface that as a structured 503 so the UI
 * can show a useful message instead of a vague 500.
 */

import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * PostgREST error code for "table not found in schema cache". Raised when
 * the new migration hasn't been applied or the schema cache is stale.
 */
export const ERR_MISSING_TABLE = "PGRST205";

/**
 * RPC function not found in schema cache. Same root cause: missing
 * migration (the function definition lives in the migration file).
 */
export const ERR_MISSING_FUNCTION = "PGRST202";

export interface ApiErrorPayload {
  status: number;
  error: string;
  code: string;
}

/**
 * Returns a structured error envelope for a Supabase / PostgREST error.
 * Recognises the migration-not-applied codes and returns a 503 with a
 * clear, actionable message; falls back to a generic 500 otherwise.
 */
export function describeDbError(
  error: PostgrestError | { code?: string; message?: string } | null,
  fallbackMessage: string,
  fallbackCode: string,
): ApiErrorPayload {
  if (!error) {
    return { status: 500, error: fallbackMessage, code: fallbackCode };
  }
  if (
    error.code === ERR_MISSING_TABLE ||
    error.code === ERR_MISSING_FUNCTION
  ) {
    return {
      status: 503,
      error:
        "This feature requires the v2 database migration. Run migrations/002_advanced_features.sql in your Supabase SQL editor.",
      code: "MIGRATION_PENDING",
    };
  }
  return { status: 500, error: fallbackMessage, code: fallbackCode };
}

export function isMigrationPending(
  error: { code?: string } | null | undefined,
): boolean {
  return (
    !!error &&
    (error.code === ERR_MISSING_TABLE || error.code === ERR_MISSING_FUNCTION)
  );
}
