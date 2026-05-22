# HUKM Deployment Guide

This guide covers (1) running HUKM locally, (2) deploying it to Vercel, and
(3) the Supabase + NVIDIA configuration the app expects.

## 1. Prerequisites

- Node.js 18.18 or later (Node 20 LTS recommended)
- npm 9 or later
- A Supabase project with the HUKM schema already provisioned (tables and
  RPCs documented in `ARCHITECTURE.md`)
- An NVIDIA API key with access to the `nvidia/nv-embedqa-e5-v5` embeddings
  endpoint and at least one chat model (`z-ai/glm4.7` is the default and
  free; see `lib/models.ts` for the full list)

## 2. Local development

```sh
git clone <repo>
cd hukm-app
cp .env.example .env.local
# Edit .env.local with the values listed in section 4
npm install
npm run dev
```

The dev server runs on http://localhost:3000 . Hot-reload is enabled. The
first request will validate every environment variable; missing values
abort startup with a clear message naming the variable.

### Local verification commands

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # next lint with --max-warnings 0
npm run build          # production build; must finish with zero errors
```

CI must run all three before merging.

## 3. Vercel deployment

HUKM is a standard Next.js 14 App Router project. Any deploy target that
supports Next.js works; the steps below are for Vercel because that's the
fastest path.

1. Push the project to a Git remote that Vercel can read (GitHub, GitLab,
   Bitbucket).
2. In Vercel, **Import Project** and pick the repo. Vercel auto-detects
   Next.js — no build configuration changes are needed.
3. Set the environment variables under **Project Settings → Environment
   Variables**. See section 4.
4. Deploy.

### Recommended Vercel settings

| Setting                  | Value                              |
| ------------------------ | ---------------------------------- |
| Framework preset         | Next.js                            |
| Build command            | `next build` (default)             |
| Output directory         | `.next` (default)                  |
| Install command          | `npm install` (default)            |
| Node.js version          | 20.x                               |
| Function region          | Closest to your Supabase region    |

The API routes use the Node.js runtime explicitly (`export const runtime =
"nodejs"`) because `@supabase/supabase-js` requires Node APIs. Don't change
this to the Edge runtime.

### Function timeouts

`/api/analyze` and `/api/chat` may take 5–10 seconds when the LLM is slow.
Bump Vercel's default function timeout to at least 30 seconds:

- **Hobby plan**: maximum 60 s (set in `vercel.json` `maxDuration` if you
  want explicit limits).
- **Pro plan**: maximum 300 s.

Add a `vercel.json` like this if you want to be explicit:

```json
{
  "functions": {
    "app/api/analyze/route.ts": { "maxDuration": 60 },
    "app/api/chat/route.ts":    { "maxDuration": 60 }
  }
}
```

## 4. Environment variables

| Variable                          | Required | Example value                          |
| --------------------------------- | -------- | -------------------------------------- |
| `NVIDIA_API_KEY`                  | yes      | `nvapi-…`                              |
| `NEXT_PUBLIC_SUPABASE_URL`        | yes      | `https://xxxx.supabase.co`             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | yes      | `eyJ…`                                 |
| `SUPABASE_SERVICE_ROLE_KEY`       | yes      | `eyJ…`  (**server-only — never expose**) |
| `REDIS_URL`                       | no       | `redis://default:password@host:6379`   |

Only the two `NEXT_PUBLIC_…` values are sent to the browser; the others stay
server-side. `lib/env.ts` enforces that all required vars are present at
module load — the very first request will throw with the missing-variable
name if any are absent.

## 5. Supabase configuration

The app assumes the schema in `ARCHITECTURE.md` is already in place. If you
need to provision it from scratch, run the existing migration scripts in
the data ingestion repo (they live outside this codebase). Verify after
migration:

```sql
-- These should each return a positive number.
SELECT count(*) FROM law_chunks;
SELECT count(*) FROM conversations;

-- The match RPC should exist:
SELECT proname FROM pg_proc WHERE proname = 'match_law_chunks';
```

### Row Level Security

All four user-facing tables have RLS enabled with deny-all policies for
`anon` and `authenticated`. The application uses the service role to bypass
those policies and enforces ownership in API routes via
`isConversationOwner` / `isAnalysisOwner`. Don't relax the RLS policies —
this is the second layer of defence after the API check.

### IVFFlat index configuration

`match_law_chunks` sets `ivfflat.probes = 10` per call to widen the ANN
search. With ~14k chunks and `lists = 100` this trades a few milliseconds
of latency for materially better recall. If you re-create the index, keep
those parameters.

## 6. NVIDIA configuration

You need an API key with at least these endpoints enabled:

- `https://integrate.api.nvidia.com/v1/embeddings`
  - Model: `nvidia/nv-embedqa-e5-v5`
  - This is a free model on NVIDIA's hosted infrastructure.
- `https://integrate.api.nvidia.com/v1/chat/completions`
  - Default model: `z-ai/glm4.7` (free)
  - Optional premium: `z-ai/glm5` (paid)
  - Fallback: `meta/llama-3.1-405b-instruct` and others (free or paid
    depending on your account)

If a premium model isn't available on your account, the request will fall
through the fallback chain automatically (`lib/nvidia.ts` →
`callChatWithFallback`). No code changes required.

## 7. Post-deployment verification

After deploying, run this smoke-test from a terminal:

```sh
# 1. Home page loads
curl -fI https://your-deployment.vercel.app/

# 2. Session endpoint mints a cookie
curl -fc cookies.txt https://your-deployment.vercel.app/api/session

# 3. Analyze (use the cookie)
curl -fb cookies.txt -X POST \
     -H "Content-Type: application/json" \
     -d '{"scenario":"On 12 March 2024 in Addis Ababa, two men entered a small shop with a knife and threatened the owner.","modelId":"z-ai/glm4.7","language":"en"}' \
     https://your-deployment.vercel.app/api/analyze

# 4. Watch the function logs in Vercel during the call. You should see:
#    [analyze] retrieval complete  { stage: 1, chunks: N }
#    [nvidia]  chat call succeeded { modelId: "z-ai/glm4.7" }
#    [analyze] parse complete     { confidenceLevel: "..." }
```

If step 3 returns an error mentioning a missing environment variable,
double-check the **Production** environment in Vercel: variables added to
**Preview** alone won't be picked up by `main`-branch deploys.

## 8. Operating the deployment

### Scaling

The API is stateless except for the in-memory rate limiter. If you horizontally
scale (multiple Vercel regions or non-Vercel hosting with multiple replicas),
swap the rate limiter to Redis:

```ts
// In a server-only bootstrap file:
import { setRateLimitStore } from "@/lib/ratelimit";
import { createRedisStore } from "./redis-store"; // your impl
if (process.env.REDIS_URL) {
  setRateLimitStore(createRedisStore(process.env.REDIS_URL));
}
```

The `RateLimitStore` interface (`hit(key, windowMs)`) is intentionally tiny
so a Redis-backed implementation is ~30 lines.

### Logs

Logs go to standard Vercel function logs (`logger.info`, `logger.warn`,
`logger.error`). Each request emits at least four structured lines:

```
[analyze] retrieval complete   { sessionId, chunks, stage, durationMs }
[nvidia]  chat call succeeded  { modelId, durationMs, totalTokens }
[analyze] parse complete       { confidenceLevel }
[analyze] persisted            { resultId }
```

Use those keys to slice latency / failure metrics in your log aggregator.

### Rotating the service role key

1. Generate a new service role key in Supabase.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
3. Trigger a redeploy.
4. Revoke the old key.

The app will pick up the new key on the next cold start.
