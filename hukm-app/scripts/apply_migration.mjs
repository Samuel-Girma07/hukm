#!/usr/bin/env node
/**
 * Print migrations/002_advanced_features.sql with a clear instruction so the
 * operator can apply it via the Supabase SQL editor. We deliberately do NOT
 * auto-apply DDL: Supabase doesn't expose the postgres connection string in
 * .env.local, and the data API doesn't accept arbitrary SQL.
 *
 * Usage:
 *   node scripts/apply_migration.mjs migrations/002_advanced_features.sql
 */

import { readFile } from "node:fs/promises";

async function loadEnv() {
  try {
    const text = await readFile(".env.local", "utf-8");
    const env = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/apply_migration.mjs <file.sql>");
    process.exit(1);
  }
  const env = await loadEnv();
  const sqlText = await readFile(path, "utf-8");
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "<set NEXT_PUBLIC_SUPABASE_URL>";

  process.stdout.write(
    `\nCopy the SQL below and paste it into the SQL editor at:\n  ${url}/project/_/sql/new\n\nThe migration is idempotent; safe to re-run.\n\n--- BEGIN SQL ---\n${sqlText}--- END SQL ---\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
