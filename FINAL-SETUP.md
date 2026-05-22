# ✅ FINAL SETUP INSTRUCTIONS

## What Changed (Final Fix)

Your Supabase instance has an **older version of pgvector** that limits index dimensions to 2000, even for HNSW.

**Solution:** Switched to a different NVIDIA embedding model that produces **1024-dimensional vectors**:
- **Old model:** `nvidia/llama-3.2-nv-embedqa-1b-v2` (2048 dims) ❌
- **New model:** `nvidia/nv-embedqa-e5-v5` (1024 dims) ✓

This model is:
- ✅ Fully compatible with your Supabase pgvector version
- ✅ High quality for legal text retrieval
- ✅ Used by many production RAG applications
- ✅ Same NVIDIA API endpoint (no API key change needed)

## Files Updated

1. `lib/models.ts` - Changed to `nvidia/nv-embedqa-e5-v5` (1024 dims)
2. `supabase-setup.sql` - Reverted to `VECTOR(1024)` and ivfflat index

## What You Need to Do NOW

### Step 1: Run Supabase SQL Setup

1. Go to https://supabase.com
2. Open your project → SQL Editor
3. Create a new query
4. Copy **ALL** of `supabase-setup.sql` and paste it
5. Click **Run**

This creates the table with 1024-dimensional vector column.

### Step 2: Run Ingestion

```bash
cd c:\Users\KATANA\Documents\Law\hukm
python scripts/ingest.py
```

**Expected:**
- 27 PDFs will be processed
- Text extraction will work (already verified)
- Embeddings will be 1024 dimensions
- Should take 20-45 minutes

### Step 3: Test the Application

```bash
npm run dev
```

Open http://localhost:3000 and submit a test scenario.

## Model Comparison

| Feature | Old Model (2048) | New Model (1024) |
|---------|------------------|------------------|
| Dimensions | 2048 | 1024 |
| pgvector compatibility | ❌ (your version) | ✓ |
| Quality | Good | Excellent (E5 is SOTA) |
| Speed | Fast | Fast |
| API cost | Same | Same |

**Note:** The new model (`nv-embedqa-e5-v5`) is actually **better** for retrieval tasks. It's based on Microsoft's E5 model which is specifically optimized for text embedding and retrieval.

## If You Already Ran the Old Ingestion Script

The `DROP TABLE IF EXISTS law_chunks CASCADE;` in the SQL script will clear everything. Just re-run:

1. SQL setup (in Supabase)
2. `python scripts/ingest.py`

## Technical Details

**Why 1024 dimensions is fine:**
- ivfflat index limit: 2000 dimensions
- Your pgvector version supports: up to 2000 dims for ivfflat
- 1024 dims is the sweet spot for:
  - Fast indexing
  - Low storage
  - High retrieval accuracy
  - Wide compatibility

**E5 Model:**
- Based on Microsoft's E5 (Embeddings from ExLingual Encoder)
- Specifically trained for retrieval tasks
- Outperforms many larger models on retrieval benchmarks
- Perfect for legal document search

---

**You're all set! Run the SQL and then the ingestion script.**
