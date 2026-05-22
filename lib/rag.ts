/**
 * HUKM — RAG (Retrieval-Augmented Generation) Layer
 *
 * Handles text embedding using NVIDIA Embeddings API and
 * retrieval of relevant law chunks from Supabase pgvector.
 */

import {
	EMBEDDING_MODEL_ID,
	EMBEDDING_ENDPOINT,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_INPUT_TYPE_PASSAGE,
	EMBEDDING_INPUT_TYPE_QUERY,
} from "./models";
import { getServerClient } from "./supabase";
import { logger } from "./logger";
import { LawChunk } from "./types";

// ============================================================================
// EMBEDDING FUNCTION
// ============================================================================

/**
 * Embeds text using the NVIDIA Embeddings API
 *
 * @param text - The text to embed
 * @param inputType - Either 'passage' (for documents) or 'query' (for search queries)
 * @returns Promise resolving to a number array (1024-dimensional vector)
 * @throws Error if the API call fails or returns invalid embedding
 */
export async function embedText(
	text: string,
	inputType: "passage" | "query" = "query",
): Promise<number[]> {
	const apiKey = process.env.NVIDIA_API_KEY;

	// Validate API key exists
	if (!apiKey || apiKey.trim() === "") {
		throw new Error(
			"NVIDIA_API_KEY is not configured. Please set it in your .env.local file.",
		);
	}

	// Validate input type
	const normalizedInputType =
		inputType === "passage"
			? EMBEDDING_INPUT_TYPE_PASSAGE
			: EMBEDDING_INPUT_TYPE_QUERY;

	try {
		const response = await fetch(EMBEDDING_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				input: [text],
				model: EMBEDDING_MODEL_ID,
				input_type: normalizedInputType,
			}),
		});

		// Check for HTTP errors
		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			throw new Error(
				`NVIDIA Embeddings API error (${response.status}): ${errorText}`,
			);
		}

		const data = await response.json();

		// Validate response structure
		if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
			throw new Error("NVIDIA Embeddings API returned no embeddings");
		}

		const embedding = data.data[0].embedding;

		// Validate embedding exists
		if (!embedding || !Array.isArray(embedding)) {
			throw new Error(
				"NVIDIA Embeddings API returned invalid embedding format",
			);
		}

		// Validate embedding dimensions (must be exactly 1024)
		if (embedding.length !== EMBEDDING_DIMENSIONS) {
			throw new Error(
				`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}. ` +
					`This may indicate the wrong model or endpoint was called.`,
			);
		}

		return embedding;
	} catch (error) {
		// Re-throw if it's already our error
		if (error instanceof Error && error.message.includes("NVIDIA")) {
			throw error;
		}
		// Wrap other errors
		throw new Error(
			`Failed to embed text: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

// ============================================================================
// DEDUPLICATION FUNCTION (MMR-style)
// ============================================================================

/**
 * Removes near-duplicate chunks using text similarity
 *
 * @param chunks - Array of LawChunk objects to deduplicate
 * @param threshold - Similarity threshold above which chunks are considered duplicates (default: 0.9)
 * @returns Deduplicated array of LawChunk objects
 */
export function deduplicateChunks(
	chunks: LawChunk[],
	threshold: number = 0.9,
): LawChunk[] {
	if (chunks.length <= 1) {
		return chunks;
	}

	const deduplicated: LawChunk[] = [];
	let duplicatesRemoved = 0;

	for (const chunk of chunks) {
		let isDuplicate = false;

		// Compare against already-accepted chunks
		for (const accepted of deduplicated) {
			const similarity = calculateTextSimilarity(chunk.content, accepted.content);
			if (similarity >= threshold) {
				isDuplicate = true;
				duplicatesRemoved++;
				logger.debug(
					`[Dedup] Removed duplicate chunk "${chunk.articleReference}" (similarity: ${(similarity * 100).toFixed(1)}% of "${accepted.articleReference}")`,
				);
				break;
			}
		}

		if (!isDuplicate) {
			deduplicated.push(chunk);
		}
	}

	if (duplicatesRemoved > 0) {
		logger.debug(
			`[Dedup] Removed ${duplicatesRemoved} near-duplicate chunk(s) from ${chunks.length} retrieved chunks`,
		);
	}

	return deduplicated;
}

/**
 * Calculates text similarity using Jaccard similarity on word sets
 * This is a simple but effective approximation for near-duplicate detection
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @returns Similarity score between 0 and 1
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
	// Normalize and tokenize
	const words1 = new Set(
		text1
			.toLowerCase()
			.replace(/[^\w\s]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 2), // Ignore short words
	);
	const words2 = new Set(
		text2
			.toLowerCase()
			.replace(/[^\w\s]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 2),
	);

	// Calculate Jaccard similarity: intersection / union
	const intersection = new Set(Array.from(words1).filter((w) => words2.has(w)));
	const union = new Set([...Array.from(words1), ...Array.from(words2)]);

	if (union.size === 0) return 0;
	return intersection.size / union.size;
}

// ============================================================================
// RETRIEVAL FUNCTION
// ============================================================================

const PRIMARY_THRESHOLD = 0.3;
const FALLBACK_THRESHOLD = 0.0;

/**
 * Defensively L2-normalises a vector. The NVIDIA embedding endpoint already
 * returns unit-length vectors, but normalising again is cheap insurance:
 * pgvector's ivfflat cosine_ops only behaves correctly when both sides are
 * unit-normalised, and we'd rather pay a microsecond per call than ship a
 * silent retrieval regression if NVIDIA ever changes that contract.
 */
function l2Normalise(vec: number[]): number[] {
	let sumSq = 0;
	for (const v of vec) sumSq += v * v;
	const norm = Math.sqrt(sumSq);
	if (!norm || !Number.isFinite(norm)) return vec;
	return vec.map((v) => v / norm);
}

interface MatchRow {
	id: number;
	document_name: string;
	article_reference: string | null;
	content: string;
	metadata: Record<string, string | number | undefined> | null;
	similarity: number;
}

function rowsToChunks(rows: MatchRow[]): LawChunk[] {
	return rows.map((row) => ({
		id: row.id,
		documentName: row.document_name,
		articleReference: row.article_reference || "Unknown Article",
		content: row.content,
		metadata: row.metadata || {},
		similarity: row.similarity,
	}));
}

/**
 * Retrieves relevant law chunks from Supabase based on a query string.
 *
 * Two-stage retrieval:
 *   1. Primary call at threshold 0.3 — high-quality matches only.
 *   2. If primary returns nothing, retry at threshold 0 and take whatever
 *      the ANN search produces. The system prompt downstream is already
 *      built to assign LOW confidence and flag the gap when matches are
 *      weak, so this gracefully degrades rather than returning an empty
 *      array (the previous behaviour, which left every analysis
 *      flying blind).
 *
 * @param query - The search query (e.g., user's scenario description)
 * @param count - Maximum number of chunks to retrieve (default: 8)
 * @returns Promise resolving to an array of LawChunk objects (possibly empty)
 */
export async function retrieveRelevantChunks(
	query: string,
	count: number = 8,
): Promise<LawChunk[]> {
	try {
		// Step 1: Embed the query
		const rawEmbedding = await embedText(query, "query");
		const queryEmbedding = l2Normalise(rawEmbedding);

		// Step 2: Create Supabase client
		const supabase = getServerClient();

		// Step 3: Primary match at the production threshold
		const primary = await supabase.rpc("match_law_chunks", {
			query_embedding: queryEmbedding,
			match_threshold: PRIMARY_THRESHOLD,
			match_count: count,
		});

		if (primary.error) {
			logger.error("Supabase retrieval error (primary):", {
				message: primary.error.message,
				code: primary.error.code,
				details: primary.error.details,
				hint: primary.error.hint,
			});
			return [];
		}

		const primaryRows = (primary.data as MatchRow[] | null) ?? [];
		if (primaryRows.length > 0) {
			return deduplicateChunks(rowsToChunks(primaryRows));
		}

		// Step 4: Fallback at threshold 0 to expose weak matches rather than
		// returning a totally empty context to the LLM.
		logger.info(
			"[RAG] Primary retrieval returned 0 chunks; falling back to threshold 0",
		);

		const fallback = await supabase.rpc("match_law_chunks", {
			query_embedding: queryEmbedding,
			match_threshold: FALLBACK_THRESHOLD,
			match_count: count,
		});

		if (fallback.error) {
			logger.error("Supabase retrieval error (fallback):", {
				message: fallback.error.message,
				code: fallback.error.code,
				details: fallback.error.details,
				hint: fallback.error.hint,
			});
			return [];
		}

		const fallbackRows = (fallback.data as MatchRow[] | null) ?? [];
		if (fallbackRows.length === 0) {
			logger.warn(
				"[RAG] No law chunks found for query even at threshold 0",
			);
			return [];
		}

		return deduplicateChunks(rowsToChunks(fallbackRows));
	} catch (error) {
		// Never throw from this function - fall back gracefully
		logger.error("retrieveRelevantChunks error:", error);
		return [];
	}
}
