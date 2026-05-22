/**
 * One-shot Supabase migration runner.
 *
 *   1. Connects via DATABASE_URL.
 *   2. Reads supabase-conversations-setup.sql.
 *   3. Inspects the schema and prints what's already there.
 *   4. Applies the migration in a transaction.
 *   5. Verifies the post-state.
 *
 * Usage:
 *   DATABASE_URL='postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres' \
 *     npx tsx scripts/apply_migration.ts
 *
 *   (URL-encode special characters in PASSWORD; @ becomes %40.)
 */

import { Client } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const sqlPath = resolve(
    process.cwd(),
    "supabase-conversations-setup.sql",
  );
  const sql = readFileSync(sqlPath, "utf-8");

  // Allow either DATABASE_URL or discrete PG* env vars so we don't have to
  // worry about URL-encoding special characters (e.g. '@') in the password.
  const url = process.env.DATABASE_URL;
  const client = url
    ? new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    : new Client({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE ?? "postgres",
        ssl: { rejectUnauthorized: false },
      });

  if (!url && !process.env.PGHOST) {
    console.error(
      "Provide either DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGPORT/PGDATABASE.",
    );
    process.exit(1);
  }

  console.log("[migrate] Connecting...");
  await client.connect();
  console.log("[migrate] Connected.");

  // ---- Pre-state ---------------------------------------------------------
  const before = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`,
  );
  console.log("[migrate] Tables BEFORE migration:");
  for (const row of before.rows) console.log("  -", row.table_name);

  const targetTables = ["conversations", "messages", "analysis_results"];
  for (const t of targetTables) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1`,
      [t],
    );
    if (r.rows[0].n > 0) {
      const c = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      console.log(`  · ${t}: exists, rows=${c.rows[0].n}`);
    } else {
      console.log(`  · ${t}: missing`);
    }
  }

  // ---- Apply -------------------------------------------------------------
  console.log("[migrate] Applying migration...");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[migrate] Migration applied OK.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] Migration failed; rolled back.");
    throw err;
  }

  // ---- Post-state --------------------------------------------------------
  for (const t of targetTables) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1`,
      [t],
    );
    if (r.rows[0].n > 0) {
      const c = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      console.log(`  · ${t}: present, rows=${c.rows[0].n}`);
    } else {
      console.log(`  · ${t}: STILL MISSING`);
    }
  }

  // RLS policies
  const policies = await client.query(
    `SELECT schemaname, tablename, policyname, roles, cmd
     FROM pg_policies
     WHERE schemaname='public' AND tablename = ANY($1)
     ORDER BY tablename, policyname`,
    [targetTables],
  );
  console.log("[migrate] RLS policies:");
  for (const p of policies.rows) {
    console.log(
      `  · ${p.tablename}.${p.policyname} cmd=${p.cmd} roles=${p.roles}`,
    );
  }

  // Functions
  const fns = await client.query(
    `SELECT routine_name FROM information_schema.routines
     WHERE routine_schema='public' AND routine_name = ANY($1)
     ORDER BY routine_name`,
    [["get_recent_conversations", "get_conversation_messages"]],
  );
  console.log("[migrate] Helper functions:");
  for (const f of fns.rows) console.log("  ·", f.routine_name);

  await client.end();
  console.log("[migrate] Done.");
}

main().catch((err) => {
  console.error("[migrate] FATAL:", err);
  process.exit(1);
});
