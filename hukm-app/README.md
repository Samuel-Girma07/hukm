# HUKM

A RAG-powered legal-analysis tool for Ethiopian criminal law. Users describe a
scenario in plain language; HUKM retrieves the most relevant articles from the
Criminal Code Proclamation 414/2004 (stored as 1024-dimensional embeddings in
Supabase pgvector), runs a structured 7-step analysis through an NVIDIA-hosted
LLM, and returns confidence-rated, source-cited results. Follow-up questions
are handled in a multi-turn chat that preserves the original analysis as
context.

> Output is AI-generated. It is not legal advice and is not a substitute for a
> qualified Ethiopian advocate.

## Features

- **Two-stage retrieval** — `match_law_chunks` is called first at threshold
  0.3 (high-precision), and only falls back to threshold 0 when the primary
  stage finds nothing.
- **Anti-hallucination prompt** — the model is forbidden from inventing
  article numbers and is told explicitly to admit ignorance rather than
  extrapolate.
- **Safe response parser** — the parser never throws. Malformed JSON,
  missing fields, or stray prose all degrade gracefully into a
  `NEEDS_REVIEW` result with the raw response preserved.
- **Tiered rate limiting** — `z-ai/*` premium models are capped at
  10 req/min/(ip, model); standard models at 30 req/min. Backend is a
  swappable `RateLimitStore` interface so Redis can be wired in without
  changing call sites.
- **Multi-turn chat** — once an analysis is generated the user can continue
  in a conversation that re-uses the same context but switches to a
  natural-language prompt (no JSON output).
- **Session-scoped ownership** — every analysis and conversation is bound
  to the caller's `hukm_session` cookie. Routes refuse to read or extend
  resources owned by another session.

## Tech stack

| Layer            | Choice                                       |
| ---------------- | -------------------------------------------- |
| Framework        | Next.js 14 (App Router)                      |
| Language         | TypeScript (`strict`, `noUncheckedIndexedAccess`) |
| Styling          | Tailwind CSS 3                               |
| Database         | Supabase Postgres + `pgvector`               |
| Embeddings       | NVIDIA `nv-embedqa-e5-v5` (1024 dims)        |
| Chat             | NVIDIA chat completions (z-ai/glm4.7 default) |
| Session          | HttpOnly cookie (`hukm_session`)             |
| Rate limiting    | Per-IP, per-model, in-memory (Redis-ready)   |

## Local setup

1. Clone the project and `cd hukm-app`.
2. Copy the environment template:
   ```sh
   cp .env.example .env.local
   ```
3. Fill in `.env.local` with the values for your Supabase project and NVIDIA
   API key. See the table below.
4. Install dependencies:
   ```sh
   npm install
   ```
5. Run the dev server:
   ```sh
   npm run dev
   ```
   Open http://localhost:3000 .

## Environment variables

| Variable                          | Required | Where it's used                                 | Notes                                               |
| --------------------------------- | -------- | ----------------------------------------------- | --------------------------------------------------- |
| `NVIDIA_API_KEY`                  | Yes      | `lib/embeddings.ts`, `lib/nvidia.ts`            | NVIDIA-hosted endpoints, used for both embeddings and chat. |
| `NEXT_PUBLIC_SUPABASE_URL`        | Yes      | `lib/supabase.ts`                               | Public; safe to ship to the browser.                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Yes      | `lib/supabase.ts` (validation only)             | Public, but unused in this codebase — the browser never reads Supabase directly. |
| `SUPABASE_SERVICE_ROLE_KEY`       | Yes      | `lib/supabase.ts` (server-only)                 | **Never** expose. Imported only behind `import "server-only"`. |
| `REDIS_URL`                       | No       | `lib/ratelimit.ts`                              | Optional. When set, swap `setRateLimitStore` to a Redis impl. |

`lib/env.ts` validates every required variable at module load time. If
anything is missing, the app throws `Missing required environment variable: X`
on the first request, naming the missing variable.

## Run commands

| Command            | What it does                                |
| ------------------ | ------------------------------------------- |
| `npm run dev`      | Next.js dev server with HMR.                |
| `npm run build`    | Production build. Must pass with zero errors. |
| `npm start`        | Start the production server (after build).  |
| `npm run lint`     | ESLint. Must pass with zero warnings.       |
| `npm run typecheck`| `tsc --noEmit` against the strict config.   |

## Project layout

```
hukm-app/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts       POST  /api/analyze
│   │   ├── chat/route.ts          POST  /api/chat
│   │   ├── conversations/route.ts POST  /api/conversations  GET /api/conversations
│   │   ├── conversations/[id]/route.ts  GET /api/conversations/:id
│   │   ├── results/[id]/route.ts        GET /api/results/:id
│   │   └── session/route.ts             GET /api/session
│   ├── chat/[conversationId]/page.tsx
│   ├── results/[id]/page.tsx
│   ├── page.tsx                   Home / scenario form
│   ├── layout.tsx
│   ├── globals.css
│   ├── error.tsx
│   ├── loading.tsx
│   └── not-found.tsx
├── components/                    UI primitives + page sections
├── lib/
│   ├── env.ts                     env validation (server-only)
│   ├── types.ts                   shared interfaces
│   ├── models.ts                  model registry — single source of truth
│   ├── logger.ts                  structured console logger
│   ├── supabase.ts                service-role Supabase client
│   ├── session.ts                 hukm_session cookie helpers
│   ├── embeddings.ts              NVIDIA embeddings + L2 normalise
│   ├── retrieval.ts               two-stage RAG retrieval
│   ├── similarity.ts              Jaccard dedup
│   ├── prompts.ts                 analysis + chat system prompts
│   ├── parser.ts                  safe response parser
│   ├── nvidia.ts                  chat client with model fallback chain
│   ├── ratelimit.ts               tiered, swappable rate limiter
│   ├── ownership.ts               session-bound resource checks
│   └── http.ts                    JSON error envelope helper
├── ARCHITECTURE.md                System architecture and data flow
├── API_DOCUMENTATION.md           Full request / response schemas
├── DEPLOYMENT_GUIDE.md            Vercel + Supabase deploy steps
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Database

The Supabase schema is created and managed outside this repo. The expected
shape (already populated with Ethiopian law data) is documented in
`ARCHITECTURE.md`. This codebase **never** writes DDL; it only calls
the existing tables and RPCs:

- Tables: `law_chunks`, `conversations`, `messages`, `analysis_results`
- RPCs:   `match_law_chunks`, `get_recent_conversations`, `get_conversation_messages`

## Deployment

See `DEPLOYMENT_GUIDE.md` for Vercel + Supabase deployment steps.

## Hard rules embedded in the codebase

- The model registry in `lib/models.ts` is the **only** place model IDs
  live. Hardcoding model IDs anywhere else will eventually drift.
- The response parser in `lib/parser.ts` **never throws**. If the LLM
  returns garbage, the user sees a `NEEDS_REVIEW` result, not a 500.
- The service role key is locked behind `import "server-only"` so a
  misplaced client import causes a build-time error.
- Inputs are validated for length, type, and ownership before any
  database write or LLM call.
- Rate limits are enforced on `/api/analyze` and `/api/chat`.

## License

Proprietary. © HUKM contributors.
