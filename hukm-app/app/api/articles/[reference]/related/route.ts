/**
 * GET /api/articles/[reference]/related
 *
 * Returns up to 5 articles related to the given `article_reference`,
 * computed by:
 *   1. Looking up the article in `law_chunks`.
 *   2. Embedding its content via `embedCached` (so popular articles
 *      hit the cache after the first call).
 *   3. Calling `match_law_chunks` and excluding the source row.
 *
 * Also returns the raw text + a basic citation count from
 * `article_access_log` so the UI can render the deep-dive panel.
 */

import { NextResponse, type NextRequest } from "next/server";

import { embedCached } from "@/lib/embeddings";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { deduplicateChunks } from "@/lib/similarity";
import { getServerClient } from "@/lib/supabase";
import type { LawChunk } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChunkRow {
  id: number;
  document_name: string;
  article_reference: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
}

interface MatchRow {
  id: number;
  document_name: string;
  article_reference: string | null;
  content: string;
  similarity: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { reference: string } },
): Promise<NextResponse> {
  const reference = decodeURIComponent(params.reference ?? "").trim();
  if (!reference) {
    return jsonError(400, "Missing article reference.", "VALIDATION");
  }

  const supabase = getServerClient();

  const sourceLookup = await supabase
    .from("law_chunks")
    .select("id, document_name, article_reference, content, metadata")
    .eq("article_reference", reference)
    .limit(1)
    .maybeSingle<ChunkRow>();

  if (sourceLookup.error || !sourceLookup.data) {
    return jsonError(404, "Article not found.", "NOT_FOUND");
  }

  const source = sourceLookup.data;

  // Citation count for the deep-dive header.
  const { count: citationCount } = await supabase
    .from("article_access_log")
    .select("id", { count: "exact", head: true })
    .eq("article_reference", reference);

  // Embed the content (cache-aware) and find neighbours.
  let related: LawChunk[] = [];
  try {
    const { embedding } = await embedCached(source.content, "passage");
    const { data, error } = await supabase.rpc("match_law_chunks", {
      query_embedding: embedding,
      match_threshold: 0,
      match_count: 8,
    });
    if (error) {
      logger.warn("[articles/related] match RPC failed", {
        error: error.message,
      });
    } else {
      const rows = (data as MatchRow[] | null) ?? [];
      related = deduplicateChunks(
        rows
          .filter((row) => row.id !== source.id)
          .map((row) => ({
            id: row.id,
            document_name: row.document_name,
            article_reference: row.article_reference ?? "Unknown article",
            content: row.content,
            similarity: row.similarity,
          })),
      ).slice(0, 5);
    }
  } catch (err) {
    logger.warn("[articles/related] embedding failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({
    success: true,
    article: {
      id: source.id,
      document_name: source.document_name,
      article_reference: source.article_reference ?? reference,
      content: source.content,
    },
    citationCount: citationCount ?? 0,
    related,
  });
}
