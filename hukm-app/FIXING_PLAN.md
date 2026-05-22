# HUKM - Fixing Plan for All Issues

**Date:** 2026-05-16  
**Priority:** Critical → High → Medium  
**Estimated Time:** 2-3 days

---

## 🔴 CRITICAL ISSUE 1: Retrieval Returns 0 Chunks

### Root Cause
The `match_law_chunks` RPC is returning 0 results for criminal law scenarios. The database has 1,000+ chunks but vector similarity search isn't finding matches.

### Diagnosis Steps (Do These First)

Run these queries in your **Supabase SQL Editor** one by one:

#### Step 1: Check if the function exists and works
```sql
-- Test the function with a zero vector (should return anything if data exists)
SELECT COUNT(*) FROM match_law_chunks(
  ARRAY(SELECT 0.0::real FROM generate_series(1, 1024))::vector(1024),
  0.0,
  5
);
```

#### Step 2: Check actual embedding data
```sql
-- See if embeddings are actually stored
SELECT 
  id,
  document_name,
  article_reference,
  LEFT(content, 100) as content_preview,
  embedding IS NOT NULL as has_embedding,
  pg_typeof(embedding) as embedding_type
FROM law_chunks
WHERE document_name = 'criminal-code-414-2004'
LIMIT 3;
```

#### Step 3: Check embedding dimensions
```sql
-- Verify embedding dimensions match
SELECT 
  id,
  dimensions(embedding) as dims
FROM law_chunks
WHERE embedding IS NOT NULL
LIMIT 1;
```

#### Step 4: Test with a real query embedding
```sql
-- Get one embedding to test with
DO $$
DECLARE
  test_embedding vector(1024);
BEGIN
  SELECT embedding INTO test_embedding 
  FROM law_chunks 
  WHERE document_name = 'criminal-code-414-2004' 
  LIMIT 1;
  
  RAISE NOTICE 'Testing with embedding from chunk id %', (SELECT id FROM law_chunks WHERE embedding = test_embedding LIMIT 1);
  
  -- Use the same embedding as query (should match itself)
  PERFORM * FROM match_law_chunks(test_embedding, 0.0, 5);
END $$;
```

### Likely Fixes

**Option A: Rebuild the match function with correct operator**
```sql
-- Drop and recreate the function with proper pgvector syntax
DROP FUNCTION IF EXISTS match_law_chunks(vector(1024), float, int);

CREATE OR REPLACE FUNCTION match_law_chunks(
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
RETURNS TABLE(
  id bigint,
  document_name text,
  article_reference text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.document_name,
    lc.article_reference,
    lc.content,
    lc.metadata,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM law_chunks lc
  WHERE lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Option B: Check if index is needed**
```sql
-- Create index if not exists (this is critical for performance)
CREATE INDEX IF NOT EXISTS idx_law_chunks_embedding 
ON law_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## 🔴 CRITICAL ISSUE 2 & 3: Chat & Feedback APIs Return 403

### Root Cause
Middleware is blocking requests. Likely CORS, CSRF, or session validation issue.

### Fix Steps

#### Step 1: Check middleware.ts
Look at `middleware.ts` in your project root. Find lines that might block `/api/chat` and `/api/feedback`:

```typescript
// Check if the matcher pattern excludes these routes
export const config = {
  matcher: ['/api/:path*'],  // This might be causing issues
};
```

#### Step 2: Fix - Add chat and feedback to allowed paths
```typescript
// In middleware.ts, modify to exclude chat/feedback from strict auth
export const config = {
  matcher: [
    '/api/analyze',
    '/api/share',
    '/api/admin/:path*',
    // Don't include /api/chat and /api/chat here if they have their own auth
  ],
};
```

OR, if using Next.js middleware with auth:
```typescript
// In middleware.ts
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip auth for chat and feedback
  if (path === '/api/chat' || path === '/api/feedback') {
    return NextResponse.next();
  }
  
  // ... rest of middleware
}
```

#### Step 3: Check CORS settings
In your Next.js config (`next.config.js` or `next.config.ts`):
```typescript
// Add headers for CORS
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ];
}
```

---

## 🟠 HIGH ISSUE 4: History Page Timeout

### Fix: Add Pagination and Index

#### SQL Migration
```sql
-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_created_at 
ON analysis_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at 
ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_results_session_id 
ON analysis_results(session_id);
```

#### Update API Route
In your history API route, add pagination:
```typescript
// In app/api/history/route.ts or wherever the history endpoint is
const LIMIT = 20;  // Only fetch 20 at a time
const OFFSET = parseInt(searchParams.get('offset') ?? '0');

// Add LIMIT and OFFSET to your Supabase query
const { data } = await supabase
  .from('analysis_results')
  .select('*')
  .order('created_at', { ascending: false })
  .range(OFFSET, OFFSET + LIMIT - 1);  // This adds LIMIT/OFFSET
```

---

## 🟠 HIGH ISSUE 5: Share API Timeout

### Fix: Optimize Share Creation

The share creation might be doing too much work. Add an index and simplify:

```sql
-- Add index for share lookups
CREATE INDEX IF NOT EXISTS idx_shares_analysis_id 
ON shares(analysis_id);
```

In your share route, ensure you're not doing heavy computation:
```typescript
// In app/api/share/route.ts
// Just insert and return - don't fetch extra data
const { data, error } = await supabase
  .from('shares')
  .insert({ analysis_id: analysisId, token: nanoid() })
  .select('token')
  .single();
```

---

## 🟡 MEDIUM ISSUE 6: Admin Stats Accessible Without Auth

### Fix: Add Auth Check

In `app/api/admin/stats/route.ts`:
```typescript
import { isAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return jsonError(401, "Admin authentication required.", "ADMIN_AUTH_REQUIRED");
  }
  // ... rest of handler
}
```

Create `lib/admin.ts` if it doesn't exist:
```typescript
export function isAdmin(request: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  
  const authHeader = request.headers.get('x-admin-password');
  return authHeader === adminPassword;
}
```

---

## 🟡 MEDIUM ISSUE 7: Article Heatmap 404

### Fix: Create Missing Route

Create `app/api/articles/heatmap/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getServerClient();
  
  const { data, error } = await supabase
    .from('article_access_log')
    .select('article_reference, document_name, count(*)')
    .group('article_reference, document_name')
    .order('count', { ascending: false })
    .limit(50);
    
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, data });
}
```

---

## Execution Order

1. **Day 1 Morning:** Run all SQL diagnosis queries
2. **Day 1 Afternoon:** Fix retrieval (CRITICAL) + rebuild match function
3. **Day 2 Morning:** Fix 403 errors (chat/feedback)
4. **Day 2 Afternoon:** Add pagination/indexes for history
5. **Day 3 Morning:** Fix admin auth + create heatmap route
6. **Day 3 Afternoon:** Test everything

---

## Quick Wins (5 minutes each)

```bash
# Add these to your .env.local
ADMIN_PASSWORD=your-secure-password-here

# Restart dev server after any middleware changes
npm run dev
```

---

## Testing After Fixes

```bash
# 1. Test retrieval
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"scenario":"A person stole a car","modelId":"meta/llama-4-maverick-17b-128e-instruct","language":"en"}'

# 2. Test chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is theft?","conversationId":"test","sessionId":"test"}'

# 3. Test feedback
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"analysisId":"your-analysis-id","rating":1}'

# 4. Test history
curl http://localhost:3000/history

# 5. Test admin
curl -H "x-admin-password: your-password" http://localhost:3000/api/admin/stats
```
