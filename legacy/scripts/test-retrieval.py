#!/usr/bin/env python3
"""
HUKM — RAG Retrieval Diagnostic Script

This script tests the RAG retrieval pipeline end-to-end:
1. Tests NVIDIA embedding API directly
2. Verifies Supabase connection
3. Tests match_law_chunks RPC with different thresholds
4. Calculates manual similarity to verify embeddings

INSTALLATION:
pip install supabase python-dotenv requests numpy

USAGE:
python scripts/test-retrieval.py

REQUIREMENTS:
- .env file in project root with:
  - NVIDIA_API_KEY
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import json
import requests
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# ============================================================================
# CONFIGURATION
# ============================================================================

EMBEDDING_MODEL_ID = "nvidia/nv-embedqa-e5-v5"
EMBEDDING_ENDPOINT = "https://integrate.api.nvidia.com/v1/embeddings"
EMBEDDING_DIMENSIONS = 1024
EMBEDDING_INPUT_TYPE_QUERY = "query"

PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Test queries - diverse scenarios to test retrieval
TEST_QUERIES = [
    "A person steals a mobile phone from someone's pocket in a crowded market",
    "Someone kills another person during a fight",
    "A government official accepts bribe to approve a contract",
    "What is the punishment for robbery with violence?",
    "Trafficking of women for prostitution",
]

# ============================================================================
# ENVIRONMENT SETUP
# ============================================================================

def load_environment():
    """Load environment variables from .env file"""
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
        print(f"[OK] Loaded environment from {ENV_FILE}")
    else:
        print(f"[WARN] {ENV_FILE} not found. Using system environment variables.")

    required_vars = ["NVIDIA_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        print(f"[ERROR] Missing required environment variables: {', '.join(missing)}")
        sys.exit(1)

    print("[OK] All required environment variables present")

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(supabase_url, supabase_key)

# ============================================================================
# EMBEDDING TEST
# ============================================================================

def test_embedding_api(test_text: str = "This is a test query about criminal law") -> list:
    """
    Test the NVIDIA embedding API directly

    Returns:
        Embedding vector if successful, None otherwise
    """
    print("\n" + "=" * 70)
    print("TEST 1: NVIDIA Embedding API")
    print("=" * 70)

    api_key = os.getenv("NVIDIA_API_KEY")
    print(f"[INFO] API Key present: {'Yes' if api_key else 'No'}")
    print(f"[INFO] API Key prefix: {api_key[:10]}..." if api_key else "[ERROR] No API key")
    print(f"[INFO] Model: {EMBEDDING_MODEL_ID}")
    print(f"[INFO] Endpoint: {EMBEDDING_ENDPOINT}")
    print(f"[INFO] Test text: '{test_text}'")

    try:
        response = requests.post(
            EMBEDDING_ENDPOINT,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "input": [test_text],
                "model": EMBEDDING_MODEL_ID,
                "input_type": EMBEDDING_INPUT_TYPE_QUERY,
            },
            timeout=30
        )

        print(f"[INFO] Response status: {response.status_code}")

        if response.status_code != 200:
            print(f"[ERROR] API error: {response.text[:500]}")
            return None

        data = response.json()

        if not data.get("data") or len(data["data"]) == 0:
            print("[ERROR] API returned no embeddings")
            return None

        embedding = data["data"][0].get("embedding")

        if not embedding:
            print("[ERROR] No embedding in response")
            return None

        if len(embedding) != EMBEDDING_DIMENSIONS:
            print(f"[ERROR] Wrong dimensions: expected {EMBEDDING_DIMENSIONS}, got {len(embedding)}")
            return None

        print(f"[OK] Embedding received: {len(embedding)} dimensions")
        print(f"[INFO] Embedding sample (first 5): {embedding[:5]}")
        print(f"[INFO] Embedding norm: {np.linalg.norm(embedding):.4f}")

        return embedding

    except requests.exceptions.Timeout:
        print("[ERROR] API timeout after 30 seconds")
        return None
    except Exception as e:
        print(f"[ERROR] Exception: {type(e).__name__}: {e}")
        return None

# ============================================================================
# SUPABASE CONNECTION TEST
# ============================================================================

def test_supabase_connection() -> bool:
    """
    Test Supabase connection and table existence

    Returns:
        True if successful, False otherwise
    """
    print("\n" + "=" * 70)
    print("TEST 2: Supabase Connection")
    print("=" * 70)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    print(f"[INFO] Supabase URL: {supabase_url}")
    print(f"[INFO] Service key present: {'Yes' if supabase_key else 'No'}")

    try:
        supabase = get_supabase_client()
        print("[OK] Supabase client created")

        # Test table existence by counting rows
        result = supabase.table("law_chunks").select("id", count="exact").execute()

        count = result.count if hasattr(result, 'count') else len(result.data)
        print(f"[OK] law_chunks table accessible")
        print(f"[INFO] Total chunks in database: {count}")

        if count == 0:
            print("[WARN] No chunks in database! Run ingest.py first.")
            return False

        # Show some sample chunks
        sample = supabase.table("law_chunks").select("id, document_name, article_reference").limit(5).execute()
        print(f"[INFO] Sample chunks:")
        for chunk in sample.data:
            print(f"       - ID {chunk['id']}: {chunk['document_name']} - {chunk['article_reference']}")

        return True

    except Exception as e:
        print(f"[ERROR] Exception: {type(e).__name__}: {e}")
        return False

# ============================================================================
# RPC RETRIEVAL TEST
# ============================================================================

def test_rpc_retrieval(query_embedding: list, thresholds: list = [0.1, 0.3, 0.5]) -> dict:
    """
    Test match_law_chunks RPC with different thresholds

    Args:
        query_embedding: The query embedding vector
        thresholds: List of thresholds to test

    Returns:
        Dictionary with results for each threshold
    """
    print("\n" + "=" * 70)
    print("TEST 3: RPC Retrieval with Different Thresholds")
    print("=" * 70)

    if not query_embedding:
        print("[ERROR] No embedding provided")
        return {}

    supabase = get_supabase_client()
    results = {}

    for threshold in thresholds:
        print(f"\n[INFO] Testing threshold: {threshold}")
        print("-" * 40)

        try:
            result = supabase.rpc(
                "match_law_chunks",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": threshold,
                    "match_count": 8,
                }
            ).execute()

            if result.data:
                chunks = result.data
                print(f"[OK] Retrieved {len(chunks)} chunks")

                for i, chunk in enumerate(chunks[:3]):  # Show top 3
                    similarity = chunk.get('similarity', 0)
                    article = chunk.get('article_reference', 'Unknown')
                    doc = chunk.get('document_name', 'Unknown')
                    content_preview = chunk.get('content', '')[:100]
                    print(f"       {i+1}. {article} ({doc}) - sim: {similarity:.4f}")
                    print(f"          Preview: {content_preview}...")

                results[threshold] = {
                    "count": len(chunks),
                    "chunks": chunks,
                }
            else:
                print(f"[WARN] No chunks retrieved at threshold {threshold}")
                results[threshold] = {"count": 0, "chunks": []}

        except Exception as e:
            print(f"[ERROR] RPC call failed: {type(e).__name__}: {e}")
            results[threshold] = {"error": str(e)}

    return results

# ============================================================================
# MANUAL SIMILARITY CALCULATION
# ============================================================================

def calculate_cosine_similarity(vec1: list, vec2: list) -> float:
    """Calculate cosine similarity between two vectors"""
    vec1_np = np.array(vec1)
    vec2_np = np.array(vec2)

    dot_product = np.dot(vec1_np, vec2_np)
    norm1 = np.linalg.norm(vec1_np)
    norm2 = np.linalg.norm(vec2_np)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return float(dot_product / (norm1 * norm2))

def test_manual_similarity(query_embedding: list, rpc_results: dict):
    """
    Manually calculate similarity to verify RPC results

    Args:
        query_embedding: The query embedding vector
        rpc_results: Results from test_rpc_retrieval
    """
    print("\n" + "=" * 70)
    print("TEST 4: Manual Similarity Verification")
    print("=" * 70)

    if not query_embedding:
        print("[ERROR] No query embedding")
        return

    # Find the best result with chunks
    best_result = None
    for threshold, result in rpc_results.items():
        if result.get("chunks"):
            best_result = result
            break

    if not best_result:
        print("[ERROR] No chunks to verify")
        return

    print(f"[INFO] Verifying similarity for {len(best_result['chunks'])} chunks:")

    # Get embeddings for retrieved chunks
    supabase = get_supabase_client()

    for i, chunk in enumerate(best_result["chunks"][:5]):  # Verify top 5
        chunk_id = chunk.get("id")
        rpc_similarity = chunk.get("similarity", 0)
        article = chunk.get("article_reference", "Unknown")

        # Fetch the actual embedding
        try:
            result = supabase.table("law_chunks").select("embedding").eq("id", chunk_id).execute()

            if result.data and len(result.data) > 0:
                chunk_embedding = result.data[0].get("embedding")

                if chunk_embedding:
                    manual_similarity = calculate_cosine_similarity(query_embedding, chunk_embedding)

                    match = "OK" if abs(rpc_similarity - manual_similarity) < 0.01 else "MISMATCH"
                    print(f"       {i+1}. {article}")
                    print(f"          RPC similarity: {rpc_similarity:.4f}")
                    print(f"          Manual similarity: {manual_similarity:.4f}")
                    print(f"          [{match}]")
                else:
                    print(f"[ERROR] No embedding for chunk {chunk_id}")
            else:
                print(f"[ERROR] Could not fetch chunk {chunk_id}")

        except Exception as e:
            print(f"[ERROR] Error fetching chunk {chunk_id}: {e}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all diagnostic tests"""
    print("=" * 70)
    print("HUKM — RAG Retrieval Diagnostic")
    print("=" * 70)

    # Step 1: Load environment
    load_environment()

    # Step 2: Test embedding API
    test_query = TEST_QUERIES[0]  # Use first test query
    query_embedding = test_embedding_api(test_query)

    if not query_embedding:
        print("\n[CRITICAL] Embedding API test failed. Cannot continue.")
        sys.exit(1)

    # Step 3: Test Supabase connection
    if not test_supabase_connection():
        print("\n[CRITICAL] Supabase connection test failed. Cannot continue.")
        sys.exit(1)

    # Step 4: Test RPC retrieval with different thresholds
    rpc_results = test_rpc_retrieval(query_embedding)

    # Step 5: Manual similarity verification
    test_manual_similarity(query_embedding, rpc_results)

    # Summary
    print("\n" + "=" * 70)
    print("DIAGNOSTIC SUMMARY")
    print("=" * 70)

    print("\n[INFO] Threshold Results:")
    for threshold, result in rpc_results.items():
        if "error" in result:
            print(f"       Threshold {threshold}: ERROR - {result['error']}")
        else:
            print(f"       Threshold {threshold}: {result['count']} chunks retrieved")

    # Recommendation
    best_threshold = None
    best_count = 0

    for threshold, result in rpc_results.items():
        if result.get("count", 0) > best_count:
            best_count = result["count"]
            best_threshold = threshold

    if best_threshold:
        print(f"\n[RECOMMENDATION] Use threshold {best_threshold} for best retrieval")
        print(f"                This returns {best_count} chunks for test query")

    print("\n[INFO] If retrieval is still empty at threshold 0.1:")
    print("       1. Check if law_chunks table has data (run ingest.py)")
    print("       2. Check if pgvector extension is installed")
    print("       3. Check if match_law_chunks function exists")
    print("       4. Check embedding dimensions match (1024)")

    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()
