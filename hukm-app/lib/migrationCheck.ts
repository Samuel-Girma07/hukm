/**
 * HUKM — Runtime migration check.
 *
 * On the first request that touches Supabase, probe whether the v2
 * tables (feedback, cached_*, usage_events, etc.) are present. Cache
 * the result in module scope so subsequent requests don't re-probe.
 *
 * If the migration is missing, log a single clear warning telling the
 * operator how to apply it. Application code never blocks on the
 * outcome — features that need those tables already degrade gracefully.
 */

import "server-only";

import { logger } from "./logger";
import { getServerClient } from "./supabase";

const PROBE_TABLES = [
  "feedback",
  "cached_embeddings",
  "cached_analyses",
  "article_access_log",
  "usage_events",
  "shared_analyses",
] as const;

let probed = false;
let probePromise: Promise<{ missing: string[] }> | null = null;

async function runProbe(): Promise<{ missing: string[] }> {
  const supabase = getServerClient();
  const missing: string[] = [];
  for (const table of PROBE_TABLES) {
    try {
      const { error } = await supabase.from(table).select("*").limit(0);
      if (error && error.code === "PGRST205") missing.push(table);
    } catch {
      // ignore — treat as unknown
    }
  }
  if (missing.length > 0) {
    logger.warn(
      "[migration] missing v2 tables. Apply migrations/002_advanced_features.sql in your Supabase SQL editor. " +
        "Affected features (feedback, share, insights, admin stats, caching, analytics) will return MIGRATION_PENDING until the migration is applied.",
      { missing },
    );
  } else {
    logger.info("[migration] v2 schema present — all tables found");
  }
  return { missing };
}

/**
 * Triggers the probe at most once per server process. Safe to call from
 * any module — returns immediately if already probed.
 */
export function ensureMigrationProbed(): void {
  if (probed) return;
  if (probePromise) return;
  probed = true;
  probePromise = runProbe();
  // Discard the result after logging. Callers that want to know can
  // import `getMigrationStatus` below.
  void probePromise.catch((err) => {
    logger.debug("[migration] probe threw", {
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function getMigrationStatus(): Promise<{ missing: string[] }> {
  if (!probePromise) {
    probed = true;
    probePromise = runProbe();
  }
  return probePromise;
}
