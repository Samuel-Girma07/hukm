# HUKM — Setup and Ingestion Guide

## Quick Start Checklist

Complete these steps **in order** before using the application:

- [ ] Step 1: Run Supabase SQL setup
- [ ] Step 2: Download legal PDFs
- [ ] Step 3: Install Python dependencies
- [ ] Step 4: Run ingestion script
- [ ] Step 5: Start dev server and test

---

## Step 1: Supabase Database Setup

**ACTION REQUIRED:** Manual step in Supabase dashboard

1. Open https://supabase.com
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Open `supabase-setup.sql` from project root
6. Copy entire contents → Paste into SQL editor
7. Click **Run** (or Ctrl+Enter)
8. Verify success message appears

**What this creates:**
- `law_chunks` table with 1024-dimension vector column
- IVFFlat index for fast cosine similarity search
- `match_law_chunks()` function for retrieval

**DO NOT SKIP:** The application will not work without this table.

---

## Step 2: Download Legal PDFs

**ACTION REQUIRED:** Download 7 PDF files

Place these files in `legal-docs/` folder:

| File Name | Source | Download Link |
|-----------|--------|---------------|
| `criminal-code-414-2004.pdf` | Ethiopian Criminal Code | https://www.wipo.int/edocs/lexdocs/laws/en/et/et011en.pdf |
| `constitution-1995.pdf` | Ethiopian Constitution | https://www.wipo.int/edocs/lexdocs/laws/en/et/et007en.pdf |
| `anti-corruption-881-2015.pdf` | Anti-Corruption Proclamation | https://chilot.files.wordpress.com/2017/04/proclamation-no-881-2015-corruption-crimes-proclamation.pdf |
| `anti-terrorism-1176-2020.pdf` | Anti-Terrorism Proclamation | https://www.lawethiopia.com/images/latest%20proclamations/1176%20A%20PROCLAMATION%20TO%20PROVIDE%20FOR%20THE%20PREVENTION%20AND%20SUPPRESSION%20OF%20TERRORISM%20CRIMES.pdf |
| `human-trafficking-909-2015.pdf` | Human Trafficking Proclamation | https://antislaverylaw.ac.uk/wp-content/uploads/2019/08/Proclamation-No.-909-2015-on-human-trafficking-Official-Gazette-English.pdf |
| `drug-control-661-2009.pdf` | Drug Control Proclamation | https://chilot.wordpress.com/2011/02/14/food-medicine-and-health-care-administration-and-control-proclamation-proclamation-no-6612009/ |
| `cassation-decisions.pdf` | Cassation Decisions (Optional) | https://chilot.wordpress.com/cassation-decisions/ |

**Verify:** You should have 6-7 PDF files in `legal-docs/` folder.

---

## Step 3: Install Python Dependencies

**ACTION REQUIRED:** Run pip install command

Open **Command Prompt** or **PowerShell**:

```bash
pip install pymupdf supabase python-dotenv requests
```

**Verify installation:**

```bash
python -c "import fitz; import supabase; print('OK')"
```

Should output: `OK`

---

## Step 4: Run Ingestion Script

**WHEN TO RUN:** After completing Steps 1-3

**WHAT TO EXPECT:**
- Takes 5-15 minutes depending on PDF sizes
- Makes API calls to NVIDIA for each article chunk
- Shows progress for each file and article

**COMMAND:**

```bash
cd c:\Users\KATANA\Documents\Law\hukm
python scripts/ingest.py
```

**Sample Output:**

```
======================================================================
HUKM — PDF Ingestion Script
======================================================================
Loaded environment from c:\Users\KATANA\Documents\Law\hukm\.env.local
Found 6 PDF file(s)
Connected to Supabase

Processing: criminal-code-414-2004
  Extracting text from criminal-code-414-2004.pdf...
  Extracted 1234567 characters from 234 pages
  Found 567 article(s)
  Embedding: Article 1 — Scope of the Criminal Code...
  Embedding: Article 2 — Definitions...
  ...

Processing: constitution-1995
  ...

======================================================================
INGESTION COMPLETE
======================================================================
Total chunks ingested: 1234
Total errors: 0
Total time: 456.78 seconds (7.61 minutes)
======================================================================
```

**TROUBLESHOOTING:**

| Error | Solution |
|-------|----------|
| `ModuleNotFoundError` | Run Step 3 (pip install) |
| `NVIDIA_API_KEY is not configured` | Check `.env.local` has valid key |
| `Supabase credentials not configured` | Check `.env.local` has Supabase keys |
| `relation "law_chunks" does not exist` | Run Step 1 (SQL setup) |
| `No PDF files found` | Check PDFs are in `legal-docs/` folder |

---

## Step 5: Test the Application

**START DEV SERVER:**

```bash
npm run dev
```

**TEST WORKFLOW:**

1. Open http://localhost:3000
2. Leave model as "GLM-4.7 (Recommended)"
3. Enter scenario: *"Someone broke into a shop at night and stole merchandise worth 5000 birr"*
4. Click "Get Legal Analysis"
5. Wait for loading state (10-30 seconds)
6. Results page should show:
   - Analysis with 7 reasoning steps
   - Confidence badge (HIGH/MEDIUM/LOW)
   - "Law Articles Retrieved" panel (expandable)
   - Sources showing actual law text from Criminal Code

**VERIFY RAG IS WORKING:**

- Expand "Law Articles Retrieved" panel
- You should see actual article text like:
  - "Article 688 — Robbery with Violence"
  - "Article 693 — Theft"
  - Similarity scores (e.g., "87% match")

If you see "No law articles were retrieved", the ingestion didn't complete successfully.

---

## Rate Limiting

**Automatically enforced** on the API:

| Model Tier | Models | Limit | Behavior |
|------------|--------|-------|----------|
| Premium | GLM-5, GLM-4.7 | 10 req/min | 429 error with retry-after |
| Fallback | Llama, Mistral, etc. | 30 req/min | 429 error with retry-after |

**For Development:** All local requests count as one IP ('anonymous').

**Headers returned:**
- `X-RateLimit-Remaining`: Requests left in window
- `Retry-After`: Seconds to wait (only on 429)

---

## Re-running Ingestion

**When to re-run:**
- After adding new PDFs to `legal-docs/`
- After updating laws
- If Supabase table was reset

**Before re-running:** You may want to clear existing data:

```sql
-- Run this in Supabase SQL Editor if you want to start fresh
TRUNCATE TABLE law_chunks RESTART IDENTITY;
```

Then run ingestion again:
```bash
python scripts/ingest.py
```

---

## Production Deployment

**Before deploying:**

1. Set up environment variables on hosting platform (Vercel, Railway, etc.)
2. Consider upgrading rate limiting to Redis (currently in-memory)
3. Ensure Supabase production credentials are used
4. Test with actual NVIDIA API key (free tier has limits)

**Environment variables needed:**
```
NVIDIA_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## Support

**Check these first:**
1. `worklog.md` — Current project status
2. `legal-docs/README.md` — PDF download links
3. Console logs — Both browser and terminal
4. Supabase logs — Dashboard > Logs

**Common issues:**
- No retrieved articles → Ingestion didn't run or failed
- 429 errors → Rate limit exceeded, wait and retry
- 500 errors → Check NVIDIA API key validity
- Empty response → Check Supabase connection
