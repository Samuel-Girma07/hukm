/**
 * HUKM â€” Citation extraction and chaining.
 *
 * When a chunk references another article (e.g., "as provided under
 * Article 123"), we automatically fetch that article to give the LLM
 * the full legal context. This dramatically improves analysis quality
 * and confidence.
 */

import "server-only";

import { getServerClient } from "./supabase";
import { deduplicateChunks } from "./similarity";
import { logger } from "./logger";
import type { LawChunk } from "./types";

// ---------------------------------------------------------------------------
// Regex patterns for Ethiopian legal citations
// ---------------------------------------------------------------------------

/** Matches "Article 123", "Art. 123", "Art 123", "Articles 123 and 124" */
const ARTICLE_REF_PATTERN =
  /(?:Article|Art\.?)\s+(\d+(?:\s*[A-Za-z])?)/gi;

/** Matches "Article 123 (1)" or "Article 123(2)" */
const ARTICLE_SUB_PATTERN =
  /(?:Article|Art\.?)\s+(\d+(?:\s*[A-Za-z])?)\s*\(\s*(\d+)\s*\)/gi;

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extracts all article number references from a chunk's content.
 * Returns normalized article reference strings like "Article 123".
 */
export function extractArticleReferences(content: string): string[] {
  const refs: string[] = [];

  // Main article references
  let match: RegExpExecArray | null;
  while ((match = ARTICLE_REF_PATTERN.exec(content)) !== null) {
    const group = match[1]!;
    if (!group) continue;
    const num = group.replace(/\s+/g, ""); // "123 A" â†’ "123A"
    refs.push(`Article ${num}`);
  }

  // Reset regex state
  ARTICLE_REF_PATTERN.lastIndex = 0;

  return [...new Set(refs)];
}

/**
 * Normalizes messy article_reference values from the database into a
 * clean "Article NNN" form suitable for matching.
 */
export function normalizeArticleReference(ref: string): string {
  // Extract number from patterns like:
  // "Article 647. (Part 2)" â†’ "Article 647"
  // "Art. 84) or other..." â†’ "Article 84"
  // "General Provisions (Part 5)" â†’ "General Provisions"
  const match = ref.match(/(?:Article|Art\.?)\s+(\d+(?:[A-Za-z])?)/i);
  if (match) {
    return `Article ${match[1]}`;
  }
  return ref; // keep as-is for non-article refs (e.g., "Preamble")
}

// ---------------------------------------------------------------------------
// Expansion (the core chaining logic)
// ---------------------------------------------------------------------------

/** Maximum number of citation-expanded chunks to add */
const MAX_EXPANDED_CHUNKS = 4;

export interface ExpandedRetrieval {
  /** Original retrieved chunks */
  primary: LawChunk[];
  /** Chunks fetched via citation chaining */
  expanded: LawChunk[];
  /** Combined and deduplicated */
  all: LawChunk[];
}

/**
 * Takes the initially retrieved chunks and expands them by fetching
 * any articles they cross-reference. This gives the LLM the full
 * legal framework instead of isolated snippets.
 */
export async function expandWithCitations(
  chunks: LawChunk[],
): Promise<ExpandedRetrieval> {
  if (chunks.length === 0) {
    return { primary: [], expanded: [], all: [] };
  }

  // Extract all referenced articles from the retrieved chunks
  const allRefs = new Set<string>();
  for (const chunk of chunks) {
    const refs = extractArticleReferences(chunk.content);
    for (const ref of refs) {
      allRefs.add(ref);
    }
  }

  // Remove self-references (don't re-fetch articles we already have)
  const existingRefs = new Set(
    chunks.map((c) => normalizeArticleReference(c.article_reference)),
  );
  const refsToFetch = [...allRefs].filter(
    (ref) => !existingRefs.has(ref),
  );

  if (refsToFetch.length === 0) {
    return { primary: chunks, expanded: [], all: chunks };
  }

  logger.info("[citations] expanding with referenced articles", {
    referencesFound: allRefs.size,
    newReferences: refsToFetch.length,
    refs: refsToFetch.slice(0, 10), // log first 10
  });

  try {
    const supabase = getServerClient();

    // Fetch chunks whose article_reference matches any of the cited articles
    // We use ilike for fuzzy matching since DB refs have "(Part N)" suffixes
    const { data, error } = await supabase
      .from("law_chunks")
      .select("id, document_name, article_reference, content, metadata")
      .or(
        refsToFetch
          .map((ref) => `article_reference.ilike.${encodeURIComponent(ref + "%")}`)
          .join(","),
      )
      .limit(MAX_EXPANDED_CHUNKS);

    if (error) {
      logger.warn("[citations] Supabase query failed", { error: error.message });
      return { primary: chunks, expanded: [], all: chunks };
    }

    const expanded: LawChunk[] =
      data?.map((row) => ({
        id: row.id,
        document_name: row.document_name,
        article_reference: row.article_reference ?? "Unknown article",
        content: row.content,
        similarity: 0, // expanded chunks have no similarity score
        // Mark as citation-expanded for the prompt builder
        _expanded: true,
      })) ?? [];

    // Deduplicate expanded against primary
    const combined = deduplicateChunks([...chunks, ...expanded]);

    logger.info("[citations] expansion complete", {
      primary: chunks.length,
      expanded: expanded.length,
      combined: combined.length,
    });

    return { primary: chunks, expanded, all: combined };
  } catch (err) {
    logger.warn("[citations] unexpected error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { primary: chunks, expanded: [], all: chunks };
  }
}

