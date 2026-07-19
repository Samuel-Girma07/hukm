/**
 * HUKM — Garbage-chunk cleanup
 *
 * The QA pass on the live database found that ~half of the ingested
 * `law_chunks` rows are OCR garbage (>15% non-ASCII characters that aren't
 * legitimate Amharic, plus very-short fragments that came out of
 * over-aggressive PDF page splitting). Those chunks pollute the vector
 * index and degrade retrieval quality.
 *
 * This script identifies and (optionally) deletes them. It is conservative
 * by default: DRY-RUN mode just reports counts and a sample. To actually
 * delete rows you must pass `--apply`.
 *
 * Heuristics (all combined with OR — a chunk is "bad" if ANY apply):
 *
 *   1. content shorter than MIN_LENGTH characters
 *   2. ratio of "junk" chars (printable non-ASCII outside the legitimate
 *      Amharic Unicode block U+1200–U+137F) is above MAX_JUNK_RATIO,
 *      AND the chunk is short enough that this isn't a natural Amharic
 *      passage (>= MIN_AMHARIC_LEN gives Amharic chunks a pass)
 *   3. content contains diagnostic OCR signatures (long runs of non-letter
 *      symbol noise like ` "'.,)( :;` chains)
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   npx tsx scripts/cleanup_garbage_chunks.ts                 # dry-run, report only
 *   npx tsx scripts/cleanup_garbage_chunks.ts --apply         # actually delete
 *   npx tsx scripts/cleanup_garbage_chunks.ts --document=anti-corruption-881-2015 --apply
 *   npx tsx scripts/cleanup_garbage_chunks.ts --sample=50     # show 50 candidates instead of 10
 */

import { createClient } from "@supabase/supabase-js";

// ----- Tunables --------------------------------------------------------------

const MIN_LENGTH = 80; // Below this, the chunk is too small to be useful.
const MAX_JUNK_RATIO = 0.15; // > 15% non-ASCII / non-Amharic = garbled.
const MIN_AMHARIC_LEN = 200; // Long passages of Amharic legitimately have lots of non-ASCII.

// ----- CLI args --------------------------------------------------------------

interface CliOptions {
  apply: boolean;
  document?: string;
  sample: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { apply: false, sample: 10 };
  for (const a of argv) {
    if (a === "--apply") opts.apply = true;
    else if (a.startsWith("--document=")) opts.document = a.slice(11);
    else if (a.startsWith("--sample=")) opts.sample = Number(a.slice(9)) || 10;
    else if (a === "-h" || a === "--help") {
      console.log(
        "Usage: npx tsx scripts/cleanup_garbage_chunks.ts [--apply] [--document=NAME] [--sample=N]",
      );
      process.exit(0);
    }
  }
  return opts;
}

// ----- Heuristics ------------------------------------------------------------

function junkRatio(text: string): number {
  if (!text) return 1;
  let junk = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // ASCII letters/digits/punctuation/whitespace are fine.
    if (cp >= 0x20 && cp <= 0x7e) continue;
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) continue;
    // Amharic Ethiopic block.
    if (cp >= 0x1200 && cp <= 0x137f) continue;
    // Ethiopic supplement / extended.
    if (cp >= 0x1380 && cp <= 0x139f) continue;
    if (cp >= 0x2d80 && cp <= 0x2ddf) continue;
    junk++;
  }
  return junk / text.length;
}

function amharicLength(text: string): number {
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x1200 && cp <= 0x137f) count++;
  }
  return count;
}

/**
 * Catches "OCR signature" patterns: long runs of single-letter "words"
 * separated by punctuation, e.g. `M' h'/9 i'i.lI llC hflh yofl·)·`.
 */
function looksLikeOcrSpray(text: string): boolean {
  // Tokens of length 1–2 made of letters/punctuation, separated by spaces.
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 12) return false;
  let shortGarbled = 0;
  for (const t of tokens) {
    if (t.length <= 3 && /[^A-Za-z0-9\u1200-\u137F]/.test(t)) shortGarbled++;
  }
  return shortGarbled / tokens.length > 0.5;
}

interface ChunkRow {
  id: number;
  document_name: string;
  article_reference: string | null;
  content: string;
}

interface Verdict {
  bad: boolean;
  reasons: string[];
}

function verdictFor(row: ChunkRow): Verdict {
  const reasons: string[] = [];
  const content = row.content ?? "";

  if (content.length < MIN_LENGTH) reasons.push(`too-short(${content.length})`);

  const ratio = junkRatio(content);
  const amh = amharicLength(content);
  if (ratio > MAX_JUNK_RATIO && amh < MIN_AMHARIC_LEN) {
    reasons.push(`junk-ratio(${(ratio * 100).toFixed(1)}%)`);
  }

  if (looksLikeOcrSpray(content)) reasons.push("ocr-spray");

  return { bad: reasons.length > 0, reasons };
}

// ----- Main ------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`[cleanup] Mode: ${opts.apply ? "APPLY (DELETE)" : "DRY-RUN"}`);
  if (opts.document) console.log(`[cleanup] Filter: document=${opts.document}`);
  console.log(
    `[cleanup] Heuristics: min_len=${MIN_LENGTH}, max_junk=${MAX_JUNK_RATIO}, amharic_pass=${MIN_AMHARIC_LEN}`,
  );

  // Iterate over the table in pages (Supabase REST caps single requests at 1000).
  const PAGE = 1000;
  let from = 0;
  let total = 0;
  const bad: { id: number; document: string; reasons: string[]; preview: string }[] = [];

  while (true) {
    let q = supabase
      .from("law_chunks")
      .select("id, document_name, article_reference, content")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts.document) q = q.eq("document_name", opts.document);

    const { data, error } = await q;
    if (error) {
      console.error("[cleanup] Fetch error:", error.message);
      process.exit(1);
    }

    const rows = (data as ChunkRow[]) ?? [];
    if (rows.length === 0) break;
    total += rows.length;

    for (const row of rows) {
      const v = verdictFor(row);
      if (v.bad) {
        bad.push({
          id: row.id,
          document: row.document_name,
          reasons: v.reasons,
          preview: (row.content ?? "")
            .replace(/\s+/g, " ")
            .slice(0, 80),
        });
      }
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  console.log(`[cleanup] Scanned ${total} chunk(s). Bad: ${bad.length}`);

  // Per-document breakdown of bad chunks
  const byDoc: Record<string, number> = {};
  for (const b of bad) byDoc[b.document] = (byDoc[b.document] ?? 0) + 1;
  console.log("[cleanup] Bad chunks by document:");
  Object.entries(byDoc)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log(`  ${n.toString().padStart(6)}  ${d}`));

  // Sample
  console.log(`[cleanup] Sample (first ${opts.sample}):`);
  for (const b of bad.slice(0, opts.sample)) {
    console.log(
      `  id=${b.id.toString().padStart(7)} | ${b.reasons.join(",")} | ${b.preview}…`,
    );
  }

  if (!opts.apply) {
    console.log("\n[cleanup] Dry-run complete. Re-run with --apply to delete.");
    return;
  }

  if (bad.length === 0) {
    console.log("[cleanup] Nothing to delete. Done.");
    return;
  }

  // Delete in batches of 200 ids
  const BATCH = 200;
  let deleted = 0;
  for (let i = 0; i < bad.length; i += BATCH) {
    const slice = bad.slice(i, i + BATCH).map((b) => b.id);
    const { error } = await supabase
      .from("law_chunks")
      .delete()
      .in("id", slice);
    if (error) {
      console.error("[cleanup] Delete batch failed:", error.message);
      process.exit(1);
    }
    deleted += slice.length;
    process.stdout.write(`[cleanup] Deleted ${deleted}/${bad.length}\r`);
  }
  console.log(`\n[cleanup] Deleted ${deleted} bad chunk(s).`);
}

main().catch((err) => {
  console.error("[cleanup] FATAL:", err);
  process.exit(1);
});
