/**
 * HUKM — Database Cleanup Script
 *
 * Removes garbage chunks and duplicate chunks from the law_chunks table.
 *
 * USAGE:
 *   # Dry run (preview changes without deleting)
 *   DRY_RUN=true npx tsx scripts/cleanup_db.ts
 *
 *   # Real cleanup (actually delete)
 *   npx tsx scripts/cleanup_db.ts
 *
 * FEATURES:
 *   1. Removes garbage chunks (non-readable characters > 30% of content)
 *   2. Removes duplicate chunks (identical content)
 *   3. Reports before/after counts per document
 *   4. Processes in batches of 100 to avoid timeouts
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Configuration
const DRY_RUN = process.env.DRY_RUN === "true";
const BATCH_SIZE = 100;
const GARBAGE_THRESHOLD = 0.3; // 30% garbage characters

// Types
interface LawChunk {
  id: number;
  document_name: string;
  article_reference: string;
  content: string;
}

interface DeletionRecord {
  id: number;
  document_name: string;
  article_reference: string;
  reason: string;
  content_preview: string;
}

interface DocumentStats {
  before: number;
  after: number;
  garbageDeleted: number;
  duplicatesDeleted: number;
}

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing Supabase environment variables");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Calculate the garbage ratio of a string
 * Uses multiple heuristics to detect OCR garbage and non-readable content
 */
function calculateGarbageRatio(content: string): number {
  if (content.length === 0) return 1;

  // Count different character types
  let letterCount = 0;
  let digitCount = 0;
  let spaceCount = 0;
  let punctuationCount = 0;
  let symbolCount = 0;
  let amharicCount = 0;

  for (const char of content) {
    const code = char.charCodeAt(0);

    // Letters (A-Z, a-z)
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      letterCount++;
    }
    // Digits (0-9)
    else if (code >= 48 && code <= 57) {
      digitCount++;
    }
    // Whitespace
    else if (code === 32 || code === 9 || code === 10 || code === 13) {
      spaceCount++;
    }
    // Common punctuation
    else if (
      (code >= 33 && code <= 47) || // !"#$%&'()*+,-./
      (code >= 58 && code <= 64) || // :;<=>?@
      code === 91 || code === 93 || // []
      code === 40 || code === 41 || // ()
      code === 123 || code === 125 || // {}
      code === 60 || code === 62 || // <>
      code === 34 || code === 39 || // "'
      code === 45 || code === 8211 || code === 8212 // hyphens and dashes
    ) {
      punctuationCount++;
    }
    // Amharic/Ethiopic
    else if (
      (code >= 0x1200 && code <= 0x137c) ||
      (code >= 0x1380 && code <= 0x139f) ||
      (code >= 0x2d80 && code <= 0x2ddf)
    ) {
      amharicCount++;
    }
    // Everything else is a symbol (potential garbage)
    else {
      symbolCount++;
    }
  }

  const total = content.length;
  const readableChars = letterCount + digitCount + amharicCount;
  const meaningfulTotal = readableChars + spaceCount + punctuationCount;

  // Heuristic 1: Too many symbols relative to letters
  // Garbage content has high symbol-to-letter ratio
  const symbolRatio = symbolCount / total;

  // Heuristic 2: Very few actual letters/digits
  // Real legal text should have mostly letters
  const letterRatio = readableChars / total;

  // Heuristic 3: Very short meaningful content
  // Chunks with < 50 letters are likely garbage
  const hasEnoughLetters = readableChars >= 50;

  // Combine heuristics
  // Garbage if:
  // - symbolRatio > 15% (too many symbols)
  // - letterRatio < 40% (not enough letters)
  // - fewer than 30 letters AND any symbols
  const isGarbage =
    symbolRatio > 0.15 ||
    letterRatio < 0.40 ||
    (readableChars < 30 && symbolCount > 0);

  // Return a score for logging
  if (isGarbage) {
    return Math.max(symbolRatio, 1 - letterRatio);
  }

  return symbolRatio;
}

/**
 * Generate a hash for content comparison
 */
function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

/**
 * Get all chunks from the database in batches
 */
async function getAllChunks(): Promise<LawChunk[]> {
  const allChunks: LawChunk[] = [];
  let offset = 0;
  let hasMore = true;

  console.log("Fetching all chunks from database...\n");

  while (hasMore) {
    const { data, error } = await supabase
      .from("law_chunks")
      .select("id, document_name, article_reference, content")
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Error fetching chunks:", error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allChunks.push(...data);
      offset += BATCH_SIZE;
      process.stdout.write(`\r  Fetched ${allChunks.length} chunks...`);
    }
  }

  console.log(`\r  Total chunks fetched: ${allChunks.length}\n`);
  return allChunks;
}

/**
 * Find garbage chunks
 */
function findGarbageChunks(chunks: LawChunk[]): DeletionRecord[] {
  console.log("Analyzing chunks for garbage content...\n");

  const garbageChunks: DeletionRecord[] = [];

  for (const chunk of chunks) {
    const garbageRatio = calculateGarbageRatio(chunk.content);

    if (garbageRatio > GARBAGE_THRESHOLD) {
      garbageChunks.push({
        id: chunk.id,
        document_name: chunk.document_name,
        article_reference: chunk.article_reference,
        reason: `Garbage ratio: ${(garbageRatio * 100).toFixed(1)}%`,
        content_preview:
          chunk.content.substring(0, 100) +
          (chunk.content.length > 100 ? "..." : ""),
      });
    }
  }

  console.log(`  Found ${garbageChunks.length} garbage chunks\n`);
  return garbageChunks;
}

/**
 * Find duplicate chunks
 */
function findDuplicateChunks(chunks: LawChunk[]): DeletionRecord[] {
  console.log("Analyzing chunks for duplicates...\n");

  const contentHashes: { [hash: string]: LawChunk[] } = {};

  // Group chunks by content hash
  for (const chunk of chunks) {
    const hash = hashContent(chunk.content);
    if (!contentHashes[hash]) {
      contentHashes[hash] = [];
    }
    contentHashes[hash].push(chunk);
  }

  const duplicates: DeletionRecord[] = [];

  // For each group with more than one chunk, mark extras as duplicates
  const hashes = Object.keys(contentHashes);
  for (const hash of hashes) {
    const group = contentHashes[hash];
    if (group.length > 1) {
      // Keep the first one, delete the rest
      const toDelete = group.slice(1);
      for (const chunk of toDelete) {
        duplicates.push({
          id: chunk.id,
          document_name: chunk.document_name,
          article_reference: chunk.article_reference,
          reason: `Duplicate of chunk ${group[0].id}`,
          content_preview:
            chunk.content.substring(0, 100) +
            (chunk.content.length > 100 ? "..." : ""),
        });
      }
    }
  }

  console.log(`  Found ${duplicates.length} duplicate chunks\n`);
  return duplicates;
}

/**
 * Delete chunks in batches
 */
async function deleteChunks(
  deletions: DeletionRecord[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  console.log(`Deleting ${deletions.length} chunks...\n`);

  // Process in batches
  for (let i = 0; i < deletions.length; i += BATCH_SIZE) {
    const batch = deletions.slice(i, i + BATCH_SIZE);
    const ids = batch.map((d) => d.id);

    const { error } = await supabase
      .from("law_chunks")
      .delete()
      .in("id", ids);

    if (error) {
      console.error(`  Error deleting batch:`, error);
      failed += batch.length;
    } else {
      success += batch.length;
      batch.forEach((d) => {
        console.log(
          `  [DELETED] ID ${d.id} | ${d.document_name} | ${d.article_reference} | ${d.reason}`
        );
      });
    }
  }

  return { success, failed };
}

/**
 * Get chunk counts per document (batched to avoid Supabase limits)
 */
async function getDocumentCounts(): Promise<{ [key: string]: number }> {
  const counts: { [key: string]: number } = {};
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("law_chunks")
      .select("document_name")
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Error getting document counts:", error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const row of data) {
        const doc = row.document_name;
        counts[doc] = (counts[doc] || 0) + 1;
      }
      offset += BATCH_SIZE;
    }
  }

  return counts;
}

/**
 * Print summary
 */
function printSummary(
  beforeCounts: { [key: string]: number },
  afterCounts: { [key: string]: number },
  garbageDeleted: number,
  duplicatesDeleted: number
) {
  console.log("\n" + "=".repeat(60));
  console.log("CLEANUP SUMMARY");
  console.log("=".repeat(60) + "\n");

  // Get all document names
  const allDocsSet = new Set([
    ...Object.keys(beforeCounts),
    ...Object.keys(afterCounts),
  ]);
  const allDocs = Array.from(allDocsSet).sort();

  console.log("DOCUMENT STATISTICS:");
  console.log("-".repeat(60));
  console.log(
    "Document".padEnd(40) +
      "Before".padStart(10) +
      "After".padStart(10)
  );
  console.log("-".repeat(60));

  let totalBefore = 0;
  let totalAfter = 0;

  for (const doc of allDocs) {
    const before = beforeCounts[doc] || 0;
    const after = afterCounts[doc] || 0;
    totalBefore += before;
    totalAfter += after;

    const docDisplay = doc.length > 38 ? doc.substring(0, 35) + "..." : doc;
    console.log(
      docDisplay.padEnd(40) +
        String(before).padStart(10) +
        String(after).padStart(10)
    );
  }

  console.log("-".repeat(60));
  console.log(
    "TOTAL".padEnd(40) +
      String(totalBefore).padStart(10) +
      String(totalAfter).padStart(10)
  );

  console.log("\nDELETION STATISTICS:");
  console.log("-".repeat(60));
  console.log(`Garbage chunks deleted:   ${garbageDeleted}`);
  console.log(`Duplicate chunks deleted: ${duplicatesDeleted}`);
  console.log(`Total deleted:            ${garbageDeleted + duplicatesDeleted}`);
  console.log("-".repeat(60));
}

/**
 * Print dry run summary
 */
function printDryRunSummary(
  counts: { [key: string]: number },
  garbage: DeletionRecord[],
  duplicates: DeletionRecord[]
) {
  console.log("\n" + "=".repeat(60));
  console.log("DRY RUN SUMMARY (NO CHANGES MADE)");
  console.log("=".repeat(60) + "\n");

  console.log("CURRENT DOCUMENT STATISTICS:");
  console.log("-".repeat(60));

  const sortedDocs = Object.keys(counts).sort();
  let total = 0;

  for (const doc of sortedDocs) {
    const count = counts[doc] || 0;
    total += count;
    const docDisplay = doc.length > 38 ? doc.substring(0, 35) + "..." : doc;
    console.log(`${docDisplay.padEnd(40)}${String(count).padStart(10)}`);
  }

  console.log("-".repeat(60));
  console.log(`${"TOTAL".padEnd(40)}${String(total).padStart(10)}`);

  console.log("\nWOULD BE DELETED:");
  console.log("-".repeat(60));
  console.log(`Garbage chunks:   ${garbage.length}`);
  console.log(`Duplicate chunks: ${duplicates.length}`);
  console.log(`Total:            ${garbage.length + duplicates.length}`);

  console.log("\nDELETION DETAILS:");
  console.log("-".repeat(60));

  console.log("\nGarbage Chunks:");
  if (garbage.length === 0) {
    console.log("  (none)");
  } else {
    for (const d of garbage.slice(0, 10)) {
      console.log(
        `  ID ${d.id} | ${d.document_name} | ${d.article_reference} | ${d.reason}`
      );
    }
    if (garbage.length > 10) {
      console.log(`  ... and ${garbage.length - 10} more`);
    }
  }

  console.log("\nDuplicate Chunks:");
  if (duplicates.length === 0) {
    console.log("  (none)");
  } else {
    for (const d of duplicates.slice(0, 10)) {
      console.log(
        `  ID ${d.id} | ${d.document_name} | ${d.article_reference} | ${d.reason}`
      );
    }
    if (duplicates.length > 10) {
      console.log(`  ... and ${duplicates.length - 10} more`);
    }
  }

  console.log("-".repeat(60));
}

/**
 * Main function
 */
async function main() {
  console.log("=".repeat(60));
  console.log("HUKM DATABASE CLEANUP SCRIPT");
  console.log("=".repeat(60));
  console.log(`\nMode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE (changes will be permanent)"}\n`);

  // Step 1: Get before counts
  console.log("Step 1: Getting current document counts...\n");
  const beforeCounts = await getDocumentCounts();

  // Step 2: Fetch all chunks
  console.log("Step 2: Fetching all chunks...\n");
  const chunks = await getAllChunks();

  // Step 3: Find garbage chunks
  console.log("Step 3: Finding garbage chunks...\n");
  const garbageChunks = findGarbageChunks(chunks);

  // Step 4: Find duplicate chunks
  console.log("Step 4: Finding duplicate chunks...\n");
  const duplicateChunks = findDuplicateChunks(chunks);

  // Step 5: Combine all deletions
  const allDeletions = [...garbageChunks, ...duplicateChunks];

  if (DRY_RUN) {
    // Dry run: just print what would be deleted
    printDryRunSummary(beforeCounts, garbageChunks, duplicateChunks);
  } else {
    // Live run: actually delete
    console.log("Step 5: Deleting chunks...\n");

    if (allDeletions.length === 0) {
      console.log("  No chunks to delete.\n");
    } else {
      const result = await deleteChunks(allDeletions);
      console.log(
        `\n  Deleted ${result.success} chunks, ${result.failed} failures\n`
      );
    }

    // Step 6: Get after counts
    console.log("Step 6: Getting updated document counts...\n");
    const afterCounts = await getDocumentCounts();

    // Step 7: Print summary
    printSummary(
      beforeCounts,
      afterCounts,
      garbageChunks.length,
      duplicateChunks.length
    );
  }

  console.log("\nDone.\n");
}

// Run the script
main().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
