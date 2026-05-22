/**
 * HUKM — RAG Benchmark Script
 *
 * Tests the retrieval quality of the RAG system against known test cases.
 * Measures: top similarity, average similarity, chunks retrieved, duplicate detection.
 *
 * Usage: npx tsx scripts/benchmark.ts
 *
 * Note: Run from the hukm directory with .env.local present.
 * Environment variables are loaded automatically by Next.js runtime.
 */

// Load environment variables manually (simple approach)
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(): void {
	const envPath = resolve(process.cwd(), ".env.local");
	if (existsSync(envPath)) {
		const content = readFileSync(envPath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith("#")) {
				const [key, ...valueParts] = trimmed.split("=");
				if (key && valueParts.length > 0) {
					const value = valueParts.join("=").replace(/^["']|["']$/g, "");
					process.env[key] = value;
				}
			}
		}
	}
}
loadEnv();

import { retrieveRelevantChunks } from "../lib/rag";
import { ConfidenceLevel } from "../lib/types";

// ============================================================================
// TEST CASES
// ============================================================================

interface TestCase {
	id: string;
	query: string;
	expectedDocument: string;
	expectedArticle: string;
	description: string;
}

const TEST_CASES: TestCase[] = [
	{
		id: "TC-01",
		description: "Anti-corruption gift acceptance",
		query:
			"A government official at the Ministry of Finance was offered a gift of 50,000 birr by a contractor to expedite the approval of a building permit. The official accepted the gift but claims it was just a gesture of appreciation and not a bribe. What are the legal implications under Ethiopian anti-corruption law?",
		expectedDocument: "anti-corruption-881-2015",
		expectedArticle: "Article 10",
	},
	{
		id: "TC-02",
		description: "Terrorism financing",
		query:
			"An individual was arrested for allegedly providing financial support to a group designated as a terrorist organization under Ethiopian law. The person claims they did not know the group was involved in terrorism and thought they were donating to a legitimate charity. What are the legal considerations under Ethiopian anti-terrorism law?",
		expectedDocument: "anti-terrorism-1176-2020",
		expectedArticle: "Terrorism financing",
	},
	{
		id: "TC-03",
		description: "Constitutional rights - 48 hour detention",
		query:
			"A journalist was arrested and detained for 48 hours without being brought before a court. The police claim national security concerns justified the extended detention. What constitutional rights are at issue here?",
		expectedDocument: "constitution-1995",
		expectedArticle: "Article 17",
	},
	{
		id: "TC-04",
		description: "Anti-corruption penalties",
		query:
			"A public prosecutor is investigating a case where a senior government official solicited bribes from multiple contractors over a period of two years, accumulating over 5 million birr in illicit gains. What penalties apply under Ethiopian anti-corruption law?",
		expectedDocument: "anti-corruption-881-2015",
		expectedArticle: "Article 11",
	},
	{
		id: "TC-05",
		description: "Direct quote test - Article 10",
		query:
			"What does Article 10 of the Anti-Corruption Proclamation 881/2015 say about officials accepting gifts or advantages?",
		expectedDocument: "anti-corruption-881-2015",
		expectedArticle: "Article 10",
	},
	{
		id: "TC-06",
		description: "Cassation precedent search",
		query:
			"Are there any Supreme Court cassation decisions related to corruption cases involving government officials?",
		expectedDocument: "cassation-decisions-vol-01-03",
		expectedArticle: "Cassation",
	},
	{
		id: "TC-07",
		description: "Constitutional human rights",
		query:
			"What are the fundamental human rights protected under the Ethiopian Constitution regarding freedom of expression and press freedom?",
		expectedDocument: "constitution-1995",
		expectedArticle: "Article 29",
	},
	{
		id: "TC-08",
		description: "Terrorism definition",
		query:
			"How does Ethiopian law define acts of terrorism and what are the penalties for terrorist offenses?",
		expectedDocument: "anti-terrorism-1176-2020",
		expectedArticle: "Article 3",
	},
	{
		id: "TC-09",
		description: "Corruption by public servant",
		query:
			"What constitutes corruption by a public servant in Ethiopia and what are the legal consequences?",
		expectedDocument: "anti-corruption-881-2015",
		expectedArticle: "Article 10",
	},
	{
		id: "TC-10",
		description: "Rights of arrested persons",
		query:
			"What rights does a person have when arrested under Ethiopian law, particularly regarding legal representation and protection from self-incrimination?",
		expectedDocument: "constitution-1995",
		expectedArticle: "Article 19",
	},
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determines the confidence level based on top similarity score
 */
function determineConfidenceLevel(topSimilarity: number): ConfidenceLevel {
	if (topSimilarity >= 0.75) return "HIGH";
	if (topSimilarity >= 0.50) return "MEDIUM";
	if (topSimilarity >= 0.30) return "LOW";
	return "NEEDS_REVIEW";
}

/**
 * Checks if the retrieved document matches expected
 */
function documentMatches(
	retrieved: string,
	expected: string,
): boolean {
	return retrieved.toLowerCase().includes(expected.toLowerCase().split("-")[0]);
}

/**
 * Checks if the article matches expected
 */
function articleMatches(
	retrieved: string,
	expected: string,
): boolean {
	// Normalize for comparison
	const normalizedRetrieved = retrieved.toLowerCase().replace(/[^a-z0-9]/g, "");
	const normalizedExpected = expected.toLowerCase().replace(/[^a-z0-9]/g, "");
	return (
		normalizedRetrieved.includes(normalizedExpected) ||
		normalizedExpected.includes(normalizedRetrieved)
	);
}

// ============================================================================
// MAIN BENCHMARK FUNCTION
// ============================================================================

interface BenchmarkResult {
	testCase: TestCase;
	topSimilarity: number;
	avgSimilarity: number;
	chunksRetrieved: number;
	duplicatesRemoved: number;
	confidenceLevel: ConfidenceLevel;
	topDocument: string;
	topArticle: string;
	documentMatch: boolean;
	articleMatch: boolean;
}

async function runBenchmark(): Promise<void> {
	console.log("=".repeat(80));
	console.log("HUKM RAG BENCHMARK");
	console.log("=".repeat(80));
	console.log(`Running ${TEST_CASES.length} test cases...\n`);

	const results: BenchmarkResult[] = [];

	for (const testCase of TEST_CASES) {
		console.log(`Running ${testCase.id}: ${testCase.description}...`);

		try {
			const chunks = await retrieveRelevantChunks(testCase.query, 8);

			if (chunks.length === 0) {
				results.push({
					testCase,
					topSimilarity: 0,
					avgSimilarity: 0,
					chunksRetrieved: 0,
					duplicatesRemoved: 0,
					confidenceLevel: "NEEDS_REVIEW",
					topDocument: "N/A",
					topArticle: "N/A",
					documentMatch: false,
					articleMatch: false,
				});
				continue;
			}

			const topSimilarity = chunks[0].similarity;
			const avgSimilarity =
				chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;
			const topDocument = chunks[0].documentName;
			const topArticle = chunks[0].articleReference;

			// Estimate duplicates removed (we retrieve 8, so if we get fewer, those were likely duplicates)
			// Note: This is an approximation since dedup happens inside retrieveRelevantChunks
			const duplicatesEstimate = Math.max(0, 8 - chunks.length);

			results.push({
				testCase,
				topSimilarity,
				avgSimilarity,
				chunksRetrieved: chunks.length,
				duplicatesRemoved: duplicatesEstimate,
				confidenceLevel: determineConfidenceLevel(topSimilarity),
				topDocument,
				topArticle,
				documentMatch: documentMatches(topDocument, testCase.expectedDocument),
				articleMatch: articleMatches(topArticle, testCase.expectedArticle),
			});
		} catch (error) {
			console.error(`Error running ${testCase.id}:`, error);
			results.push({
				testCase,
				topSimilarity: 0,
				avgSimilarity: 0,
				chunksRetrieved: 0,
				duplicatesRemoved: 0,
				confidenceLevel: "NEEDS_REVIEW",
				topDocument: "ERROR",
				topArticle: "ERROR",
				documentMatch: false,
				articleMatch: false,
			});
		}
	}

	// Print results table
	console.log("\n" + "=".repeat(80));
	console.log("BENCHMARK RESULTS");
	console.log("=".repeat(80) + "\n");

	// Header
	console.log(
		"ID".padEnd(6) +
			"| Exp. Doc Match | Top Article".padEnd(30) +
			"| Top Sim | Avg Sim | Chunks | Confidence".padEnd(25) +
			"| Result",
	);
	console.log("-".repeat(80));

	// Results
	let passCount = 0;
	for (const r of results) {
		const passed = r.documentMatch;
		if (passed) passCount++;

		const id = r.testCase.id.padEnd(6);
		const docMatch = (r.documentMatch ? "YES" : "NO").padEnd(14);
		const article = r.topArticle.substring(0, 25).padEnd(27);
		const topSim = `${(r.topSimilarity * 100).toFixed(1)}%`.padEnd(8);
		const avgSim = `${(r.avgSimilarity * 100).toFixed(1)}%`.padEnd(8);
		const chunks = String(r.chunksRetrieved).padEnd(7);
		const confidence = r.confidenceLevel.padEnd(12);
		const result = passed ? "PASS" : "FAIL";

		console.log(
			`${id}| ${docMatch}| ${article}| ${topSim}| ${avgSim}| ${chunks}| ${confidence}| ${result}`,
		);
	}

	// Summary
	console.log("-".repeat(80));
	console.log(
		`\nSUMMARY: ${passCount}/${results.length} tests passed (${((passCount / results.length) * 100).toFixed(1)}%)`,
	);

	// Confidence distribution
	const confidenceCounts = {
		HIGH: results.filter((r) => r.confidenceLevel === "HIGH").length,
		MEDIUM: results.filter((r) => r.confidenceLevel === "MEDIUM").length,
		LOW: results.filter((r) => r.confidenceLevel === "LOW").length,
		NEEDS_REVIEW: results.filter((r) => r.confidenceLevel === "NEEDS_REVIEW")
			.length,
	};

	console.log("\nConfidence Distribution:");
	console.log(`  HIGH:        ${confidenceCounts.HIGH}`);
	console.log(`  MEDIUM:      ${confidenceCounts.MEDIUM}`);
	console.log(`  LOW:         ${confidenceCounts.LOW}`);
	console.log(`  NEEDS_REVIEW: ${confidenceCounts.NEEDS_REVIEW}`);

	// Average metrics
	const avgTopSim =
		results.reduce((sum, r) => sum + r.topSimilarity, 0) / results.length;
	const avgChunks =
		results.reduce((sum, r) => sum + r.chunksRetrieved, 0) / results.length;

	console.log("\nAverage Metrics:");
	console.log(`  Top Similarity:   ${(avgTopSim * 100).toFixed(2)}%`);
	console.log(`  Chunks Retrieved: ${avgChunks.toFixed(1)}`);
}

// Run the benchmark
runBenchmark().catch(console.error);
