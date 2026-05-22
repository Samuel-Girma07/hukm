# Hukm — Deployment Guide

This guide covers everything needed to take Hukm from a fresh clone to a
running production deployment.

---

## 0. What you need before you start

| Requirement                          | Notes                                       |
|--------------------------------------|---------------------------------------------|
| Node.js ≥ 18 + npm                   | Confirmed against Next.js 14.2              |
| A Supabase project                   | Free tier works for demos                   |
| `pgvector` extension on Supabase     | Already enabled by `supabase-setup.sql`     |
| An NVIDIA NIM API key                | Required for embeddings + chat              |
| Python 3.10+                         | One-time PDF ingestion only                 |
| ~30 GB free disk for legal-docs/     | Optional; only if you re-run ingestion      |

---

## 1. Local development setup

```bash
git clone <this-repo>
cd hukm
npm install
```

### 1.1 Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```
NVIDIA_API_KEY=nvapi-...
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

> ⚠️ **Never** commit a populated `.env` or `.env.local`. Both are
> gitignored. The legacy `.env` filename in particular is now in
> `.gitignore` to prevent accidental check-ins.

### 1.2 Run database migrations

In the Supabase SQL Editor, run **both** scripts in order:

1. `supabase-setup.sql`
   - Enables `pgvector`
   - Creates `law_chunks (… embedding VECTOR(1024))`
   - Creates the `match_law_chunks(query_embedding, …)` RPC
2. `supabase-conversations-setup.sql`
   - Creates `conversations`
   - Creates `messages`
   - Creates `analysis_results` (used to persist single-shot analyses
     so the `/results/[id]` page survives a refresh)
   - Creates the `get_recent_conversations` and
     `get_conversation_messages` helper functions

### 1.3 Ingest legal PDFs (first run only)

Drop the source PDFs into `legal-docs/` (see `legal-docs/README.md` for
download links), then:

```bash
pip install pymupdf supabase python-dotenv requests
python scripts/ingest.py
```

This takes ~5–15 minutes for the core proclamations and longer if you
include all Cassation Decision volumes. The script reads
`<repo>/.env` or your environment, so set the same vars used by the
Next.js app.

### 1.4 Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## 2. Manual smoke-test checklist

### 2.1 Analysis flow

1. Open `/`.
2. Optionally select a different model from the dropdown.
3. Type a scenario of at least 10 characters, e.g.
   *"Someone broke into a shop at night and stole goods worth 5000 birr."*
4. Click **Get Legal Analysis**.
5. You should be redirected to **`/results/<uuid>`** showing:
   - Confidence badge
   - Estimated punishment
   - Seven reasoning steps
   - Procedural roadmap
   - **Law Articles Retrieved (N)** — expand and confirm real article text
6. **Refresh the page**. It should reload the same result from Supabase
   without falling back to the home page. (If you see a "Result not
   found" screen, the `analysis_results` table is missing — re-run
   `supabase-conversations-setup.sql`.)

### 2.2 Conversation flow

1. From the results page, click **Continue Conversation**.
2. You should land on `/chat/<conversationId>` with the original
   scenario already showing as a user message.
3. Type a follow-up question (e.g. "What if the person was under 15?")
   and press Send.
4. The AI response should stream in within ~5–30 s.
5. Refresh the page — the entire conversation should reload from
   Supabase.

### 2.3 Rate-limiting flow

Premium models (`z-ai/glm4.7`, `z-ai/glm5`) cap at 10 req/min per IP.
Fire 11 quick requests in a row and you should see a 429 with a
`Retry-After` header. The same applies to `/api/chat` (it now enforces
the same limits).

### 2.4 Error states

- Submit a description shorter than 10 characters → friendly inline
  validation.
- Set `NVIDIA_API_KEY=` to an invalid value → server returns 502 with
  "AI service unavailable".
- Visit `/results/00000000-0000-0000-0000-000000000000` → friendly
  "Result not found" view, not a stack trace.

---

## 3. Automated checks

These should all pass before you ship a build.

```bash
npm run lint   # → No warnings or errors
npm run build  # → Compiled successfully, 7 routes
npm test       # → 78 tests passing across 10 files
```

If any of these fail, do **not** deploy — re-open the relevant
component and fix the regression.

---

## 4. Production deployment (Vercel)

Hukm is a vanilla Next.js 14 App Router app with no exotic build steps,
so any Next.js-aware host works. The example below uses Vercel.

1. **Push to GitHub/GitLab** (with `.env`, `.env.local`, and
   `legal-docs/` excluded — they already are in `.gitignore`).
2. **Create a new Vercel project** pointing at the repo.
3. **Configure environment variables** in Vercel → Project →
   Settings → Environment Variables:
   - `NVIDIA_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Deploy**. Vercel runs `next build` for you; verify the build log
   matches your local `npm run build`.
5. **Run the SQL migrations** (`supabase-setup.sql` and
   `supabase-conversations-setup.sql`) against the production
   Supabase project — *not* a dev one.
6. **Re-ingest the legal PDFs** against the production Supabase project,
   pointing `scripts/ingest.py` at production credentials.
7. **Smoke test in production** using the checklist in §2.

### 4.1 Custom hosts (Netlify, Render, Fly, etc.)

The same checklist applies. Just make sure:

- The host runs Node ≥ 18.
- All four env vars are set (the app crashes loudly with a clear error
  message if any are missing — see `lib/supabase.ts`).
- The host's outbound network can reach
  `https://integrate.api.nvidia.com/*` and your Supabase URL.

### 4.2 Production hardening (recommended next steps)

| Task                                    | Why                                          |
|-----------------------------------------|----------------------------------------------|
| Swap in Redis-backed rate-limit store   | Current limiter is per-instance only         |
| Add error monitoring (Sentry/Rollbar)   | `lib/logger.ts` silently drops in prod       |
| Add structured logging (pino, etc.)     | Pair with the monitoring above               |
| Lock down Supabase RLS policies         | Current policies are wide-open `USING (true)`|
| Rotate any keys that ever lived in `.env` | The legacy file is gone but rotation is hygiene |

---

## 5. Common operational issues

| Symptom                                                  | Likely cause                                              | Fix                                                       |
|----------------------------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------|
| `/results/[id]` shows "Result not found" after analyze   | `analysis_results` table missing                          | Re-run `supabase-conversations-setup.sql`                 |
| 500 with "Database configuration error"                  | Supabase env vars missing/typo                            | Re-check `.env.local` and your deployment env vars        |
| 502 with "AI service unavailable"                        | NVIDIA key invalid/expired/quota exhausted                | Rotate `NVIDIA_API_KEY` and restart                       |
| 429 with "Rate limit exceeded"                           | Working as designed                                       | Wait `Retry-After` seconds, or scale to multi-instance + Redis |
| Sources panel says "No specific law articles…"           | Vector search returned nothing                            | Confirm ingestion finished and `law_chunks` is populated  |
| `npm run build` fails on `scripts/*.ts`                  | Stray TypeScript in scripts                               | Already excluded via `tsconfig.json`; if reintroduced, fix the type or keep it excluded |

---

## 6. Where to look when things go wrong

- `lib/logger.ts` — wraps `console.*` and is silenced in production.
  Switch to a structured logger before relying on prod logs.
- `app/api/analyze/route.ts` — the canonical example of the
  rate-limit / RAG / NVIDIA / persistence pipeline.
- `app/api/chat/route.ts` — same pipeline, but for multi-turn chat.
- `__tests__/api/*.test.ts` — show how to mock NVIDIA + Supabase
  cleanly so you can iterate without hitting live services.
- `worklog.md` and `.ai/PROJECT_AUDIT.md` — historical context for
  earlier engineering decisions.

---

## 7. Done. Ship it.

If §2 and §3 both pass against production, you're shipped. Drop a
post-deploy smoke test (one analysis + one chat turn) into your
release checklist and you're set.
