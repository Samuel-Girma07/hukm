# Hukm — Ethiopian Sentencing Assistant

AI-assisted, **article-cited** legal analysis for Ethiopian criminal-law
scenarios. Hukm retrieves the actual law text from a Supabase pgvector
database, then asks an NVIDIA-hosted LLM to apply it to the user's scenario
through a 7-step legal-reasoning framework. Answers are accompanied by the
exact source articles that were used.

> ⚠️ Hukm is a research/triage tool. It does **not** replace a qualified
> Ethiopian advocate.

---

## Features

- **RAG over Ethiopian law** — Constitution, Criminal Code, Anti-Corruption,
  Anti-Terrorism, Human Trafficking, Drug Control, Federal Cassation
  Decisions
- **7-step structured analysis** — facts → classification → elements →
  defenses → sentencing framework → precedent → conclusion, with a
  per-result confidence rating
- **Source transparency** — every result links back to the retrieved
  articles + similarity scores
- **Multi-turn conversation** — continue from any analysis to ask follow-up
  questions, with full conversation context persisted in Supabase
- **Multi-model support** — GLM-4.7/GLM-5 (primary) plus Llama, DeepSeek,
  and Mistral fallbacks via NVIDIA NIM
- **Persisted results** — results are saved server-side, so refreshing
  the results page works
- **Tier-aware rate limiting** — premium models (`z-ai/*`) get 10 req/min,
  fallback models 30 req/min, applied to both `/api/analyze` and `/api/chat`

---

## Tech Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Framework   | Next.js 14 (App Router)                             |
| Language    | TypeScript (strict)                                 |
| UI          | Tailwind CSS                                        |
| Database    | Supabase (PostgreSQL + pgvector)                    |
| Embeddings  | `nvidia/nv-embedqa-e5-v5` (1024 dims)               |
| Chat models | NVIDIA NIM API (GLM, Llama, DeepSeek, Mistral)      |
| Sessions    | HTTP-only cookies, 30-day persistence               |
| Tests       | Vitest + React Testing Library + jsdom              |
| Ingestion   | Python 3 + PyMuPDF                                  |

---

## Architecture

```
Browser ── ScenarioForm ──▶ POST /api/analyze ──┐
                                                 ├─▶ retrieveRelevantChunks()
                                                 │     └─▶ NVIDIA Embeddings
                                                 │     └─▶ Supabase pgvector
                                                 ├─▶ buildPromptWithContext()
                                                 ├─▶ NVIDIA Chat API
                                                 ├─▶ parseResponse() (never throws)
                                                 └─▶ Supabase: analysis_results
Browser ◀── 302 to /results/[id] ◀── { resultId, result, retrievedChunks }

Browser ── ChatInterface ──▶ POST /api/chat ────┐
                                                 ├─▶ rate limit check
                                                 ├─▶ Supabase: conversations + messages
                                                 ├─▶ retrieveRelevantChunks()
                                                 ├─▶ NVIDIA Chat API (with history)
                                                 └─▶ Supabase: store assistant message
```

### Project structure

```
app/
  api/
    analyze/route.ts        # Single-shot RAG + analysis endpoint
    chat/route.ts           # Multi-turn conversation endpoint
  results/[id]/page.tsx     # Server-persisted results view
  chat/[conversationId]/    # Conversation continuation
  page.tsx                  # Home (scenario form)
  layout.tsx
components/                 # ScenarioForm, AnalysisResult, ChatInterface, …
lib/
  models.ts                 # Model + endpoint registry (single source of truth)
  rag.ts                    # Embedding + retrieval + dedup
  nvidia.ts                 # NVIDIA chat client
  parser.ts                 # JSON response parser (never throws)
  systemPrompt.ts           # Base prompt + retrieved-context injection
  supabase.ts               # Centralized Supabase clients
  rateLimit.ts              # In-memory rate limiter (Redis-swappable)
  session.ts                # Cookie session helper
  logger.ts                 # Dev-only logger
  types.ts                  # Shared interfaces
scripts/
  ingest.py                 # PDF → chunks → embeddings → Supabase
__tests__/                  # Vitest unit + component + API tests
supabase-setup.sql                     # law_chunks + match_law_chunks RPC
supabase-conversations-setup.sql       # conversations + messages + analysis_results
```

---

## Prerequisites

- Node.js ≥ 18 and npm
- A Supabase project (with `pgvector` extension)
- An NVIDIA API key with access to NIM endpoints
- Python 3.10+ (only for one-time PDF ingestion)

---

## Setup

1. **Clone & install**
   ```bash
   git clone <this-repo>
   cd hukm
   npm install
   ```

2. **Configure environment** — copy `.env.example` → `.env.local` and fill
   in real values:
   ```bash
   cp .env.example .env.local
   ```
   Required:
   ```
   NVIDIA_API_KEY=nvapi-...
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   Never put real credentials in `.env`; that file is gitignored
   precisely because the legacy convention leaks it.

3. **Run database migrations** in the Supabase SQL editor:
   - `supabase-setup.sql` (creates `law_chunks` + `match_law_chunks()`)
   - `supabase-conversations-setup.sql` (creates `conversations`, `messages`,
     and the new `analysis_results` table for persisted results)

4. **Ingest legal PDFs** — drop the source PDFs into `legal-docs/` (see
   `legal-docs/README.md` for download links) and run:
   ```bash
   pip install pymupdf supabase python-dotenv requests
   python scripts/ingest.py
   ```

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>.

---

## Commands

| Command           | Purpose                                    |
|-------------------|--------------------------------------------|
| `npm run dev`     | Start dev server                           |
| `npm run build`   | Type-check + production build              |
| `npm run start`   | Run the production build                   |
| `npm run lint`    | ESLint (`next lint`)                       |
| `npm test`        | Run the full Vitest suite                  |
| `npm run test:watch` | Re-run tests on change                  |

---

## Environment variables

| Variable                          | Where used      | Notes                              |
|-----------------------------------|-----------------|-------------------------------------|
| `NVIDIA_API_KEY`                  | server          | Embeddings + chat completions       |
| `NEXT_PUBLIC_SUPABASE_URL`        | client + server | Public Supabase URL                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | client          | Anon key (used by browser pages)    |
| `SUPABASE_SERVICE_ROLE_KEY`       | server only     | **Never** ship to the browser       |

`lib/supabase.ts` validates these with helpful error messages — missing
vars surface as a 500 with a clear server log instead of a cryptic
runtime crash.

---

## Testing

The Vitest suite covers:

- `lib/`: parser, rate limiter, model registry, system prompt, RAG
  dedup/similarity helpers
- `app/api/`: `/api/analyze` and `/api/chat` route handlers (Supabase,
  NVIDIA, and session helpers are mocked at module level)
- `components/`: `ScenarioForm`, `AnalysisResult`, `ChatInterface`
  (rendered with `@testing-library/react` + jsdom)

Run them with `npm test`.

---

## Security model

- All calls to the AI/DB are server-side; the browser only ever talks
  to `/api/*`.
- Rate limiting is enforced on **both** `/api/analyze` and `/api/chat`
  using IP + model id as the bucket key. Premium tier defaults to 10
  req/min; fallback tier to 30.
- The service-role Supabase key is never read in client components —
  `lib/supabase.ts` exposes a `getBrowserClient()` (anon) and
  `getServerClient()` (service role) so the boundary is explicit.
- The system prompt enforces strict anti-hallucination rules and prefers
  retrieved law text over the model's training memory. Confidence
  defaults to `NEEDS_REVIEW` whenever a response can't be parsed.

---

## Deployment

See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for a step-by-step
local + production checklist.

---

## License

This project ships legal-analysis tooling under no warranty. Outputs are
generated by AI and must be reviewed by a qualified Ethiopian advocate
before any real-world use.
