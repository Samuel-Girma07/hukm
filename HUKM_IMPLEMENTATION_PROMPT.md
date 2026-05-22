# HUKM Project - Complete Implementation & Optimization

You are a senior full-stack engineer tasked with bringing the HUKM project (Ethiopian Sentencing Assistant) to production-ready status. This is a RAG-powered Next.js application using NVIDIA APIs and Supabase.

## Your Mission

Transform this codebase from its current state to production-ready by:
1. **Fixing all critical issues** (security, build failures, test failures)
2. **Adding essential improvements** (rate limiting, centralized clients, comprehensive tests)
3. **Implementing missing features** (proper result persistence, documentation)
4. **Cleaning up** (remove unused files, fix configurations)
5. **Verifying everything works** (build, test, manual verification)
6. **Providing deployment guide** for the user

---

## CRITICAL RULES

**YOU MUST follow these rules. No exceptions.**

1. **Security First**: Fix ALL security issues IMMEDIATELY before any other work
2. **Test Everything**: After EVERY change, run tests. Build must pass. Tests must pass.
3. **Never Break Working Code**: Read existing code before modifying. Preserve working functionality.
4. **Verify Before Proceeding**: After each phase, verify the build passes and tests pass
5. **Document Your Changes**: Keep a running log of what you changed and why

---

## Phase 1: CRITICAL SECURITY FIXES (DO FIRST)

**These are non-negotiable. Fix these before anything else.**

### 1.1 Fix .env Security Exposure

**Current Issue**: .env file with real API keys exists and is NOT gitignored.

**YOU MUST**:
1. Read .gitignore and verify .env is NOT listed
2. Add `.env` to .gitignore (keep .env.example, .env.local, .env*.local)
3. Create a backup of .env values to a SECURE location (show user where)
4. Delete the .env file from the repository
5. Verify .env is now gitignored: `git check-ignore .env` should return .env

**Verification**:
```bash
git check-ignore .env  # Must return: .env
test -f .env && echo "FAIL: .env still exists" || echo "PASS: .env removed"
```

### 1.2 Fix Build Failure

**Current Issue**: `scripts/test_retrieval.ts:48:17` - Parameter 'chunk' implicitly has 'any' type

**YOU MUST**:
1. Read `scripts/test_retrieval.ts` line 48
2. Add explicit type annotation to the forEach callback parameter
3. Run `npm run build` to verify the fix
4. If build still fails, exclude scripts/ from tsconfig.json

**Verification**:
```bash
npm run build  # Must succeed with exit code 0
```

### 1.3 Fix Failing Unit Tests

**Current Issue**: 4 tests in `__tests__/parser.test.ts` expect "LOW"/"MEDIUM" but code returns "NEEDS_REVIEW"

**YOU MUST**:
1. Read `__tests__/parser.test.ts` and identify the 4 failing tests
2. Read `lib/parser.ts` lines 88 and 158 to confirm "NEEDS_REVIEW" is correct
3. Update test expectations to match actual code behavior
4. Run `npm test` to verify all tests pass

**Verification**:
```bash
npm test  # Must show 42/42 tests passing (38 + 4 fixed)
```

---

## Phase 2: HIGH-PRIORITY IMPROVEMENTS

### 2.1 Add Rate Limiting to /api/chat

**Current Issue**: `/api/analyze` has rate limiting, but `/api/chat` does NOT.

**YOU MUST**:
1. Read `app/api/analyze/route.ts` to see how checkRateLimit() is used
2. Read `app/api/chat/route.ts`
3. Add the same rate limiting pattern to the chat route
4. Verify rate limiting works by checking the implementation

### 2.2 Centralize Supabase Client Creation

**Current Issue**: createClient() is called in 4 different places with inline env var access.

**YOU MUST**:
1. Create `lib/supabase.ts` with:
   - `getServerClient()` for server-side usage (API routes)
   - `getBrowserClient()` for client-side usage (pages)
   - Proper env var validation with helpful error messages
2. Replace all createClient() calls in:
   - `app/api/analyze/route.ts`
   - `app/api/chat/route.ts`
   - `app/results/page.tsx`
   - `app/chat/[conversationId]/page.tsx`
3. Remove the `!` assertions - use proper validation instead


### 2.3 Replace sessionStorage with Server-Side Persistence

**Current Issue**: Analysis results stored in sessionStorage are lost on refresh.

**YOU MUST**:
1. Read `app/results/page.tsx` to understand current flow
2. Modify `/api/analyze` to store results in Supabase (create `analysis_results` table if needed)
3. Update `/results` page to fetch from Supabase using result ID from URL
4. Update home page to navigate to `/results/[id]` instead of `/results`
5. Add proper error handling for missing results

---

## Phase 3: COMPREHENSIVE TESTING

### 3.1 Add API Route Tests

**YOU MUST create tests for**:
- `__tests__/api/analyze.test.ts` - Test /api/analyze route
  - Valid scenario submission
  - Rate limiting enforcement
  - Invalid input handling
  - Mock NVIDIA API and Supabase calls
- `__tests__/api/chat.test.ts` - Test /api/chat route
  - Conversation creation
  - Message flow
  - Rate limiting enforcement
  - Error handling

### 3.2 Add lib/rag.ts Tests

**YOU MUST create**:
- `__tests__/rag.test.ts`
  - Test `deduplicateChunks()` with various similarity thresholds
  - Test `calculateTextSimilarity()` with known inputs
  - Test edge cases (empty arrays, identical chunks, no overlap)

### 3.3 Add Component Tests

**YOU MUST create**:
- `__tests__/components/ScenarioForm.test.tsx` - Form validation, submission
- `__tests__/components/AnalysisResult.test.tsx` - Rendering, confidence badges
- `__tests__/components/ChatInterface.test.tsx` - Message sending, display

**Install if needed**: `npm install --save-dev @testing-library/react @testing-library/jest-dom`

---

## Phase 4: DOCUMENTATION & POLISH

### 4.1 Update README.md

**YOU MUST replace the default Next.js README with**:
- Project title and description (Ethiopian Sentencing Assistant)
- Features list
- Tech stack
- Prerequisites (Node.js, npm, Supabase account, NVIDIA API key)
- Setup instructions (step-by-step)
- Environment variables documentation
- Running the app (dev, build, test)
- Project structure overview
- Architecture diagram (text-based)

### 4.2 Fix Console.log Statements

**YOU MUST**:
1. Find all `console.log` and `console.error` in API routes
2. Replace with `logger.info()` and `logger.error()` from `lib/logger.ts`
3. Ensure consistent logging approach

### 4.3 Fix Font Configuration

**YOU MUST choose ONE**:
- Option A: Use Geist fonts - Update `app/globals.css` to use `var(--font-geist-sans)`
- Option B: Remove Geist fonts - Remove font imports from `app/layout.tsx`

### 4.4 Fix Loading State Model Name

**YOU MUST**:
1. Read `app/page.tsx` to find `<LoadingState modelName="GLM-4.7" />`
2. Pass the actually selected model's display name instead of hardcoded value

---

## Phase 5: CLEANUP

### 5.1 Remove Orphaned Directories

**YOU MUST**:
```bash
rm -rf hukm/  # Empty scaffolding artifact
```

### 5.2 Exclude Scripts from Build

**YOU MUST**:
1. Read `tsconfig.json`
2. Add `"exclude": ["node_modules", "scripts"]` or update existing exclude array
3. Verify build still works: `npm run build`

### 5.3 Remove Calculator Page (or Implement)

**YOU MUST choose ONE**:
- Option A: Remove - Delete `app/calculator/page.tsx` and remove nav link
- Option B: Implement - Create a simple time-served calculator (date math only)

**Recommendation**: Remove for now (can add later as separate feature)

---

## Phase 6: FINAL VERIFICATION

**YOU MUST run these commands and ALL must pass**:

```bash
# 1. TypeScript compilation
npm run build
# Expected: Build succeeds, no errors

# 2. Linting
npm run lint
# Expected: No warnings or errors

# 3. All tests
npm test
# Expected: All tests pass (should be 50+ tests now)

# 4. Check git status
git status
# Expected: .env should NOT appear in untracked files
```


---

## Phase 7: DEPLOYMENT GUIDE FOR USER

**YOU MUST create a file `DEPLOYMENT_GUIDE.md` with**:

### Local Testing Instructions
1. Copy .env.example to .env.local
2. Fill in required environment variables:
   - NVIDIA_API_KEY
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
3. Install dependencies: `npm install`
4. Run database migrations (if any)
5. Start dev server: `npm run dev`
6. Open http://localhost:3000

### Testing the Application
1. **Test Analysis Flow**:
   - Go to home page
   - Select a model
   - Enter a criminal scenario
   - Submit and verify results page loads
   - Check that results persist on refresh
   
2. **Test Chat Flow**:
   - From results page, click "Continue Conversation"
   - Send a follow-up message
   - Verify response appears
   - Refresh page - conversation should persist

3. **Test Rate Limiting**:
   - Submit multiple requests rapidly
   - Verify rate limit error appears after threshold

### Production Deployment
1. Set up Supabase project
2. Run SQL setup scripts
3. Ingest legal documents using `scripts/ingest.py`
4. Deploy to Vercel/Netlify
5. Set environment variables in deployment platform
6. Test all flows in production

---

## EXECUTION CHECKLIST

**Track your progress. Mark each item as you complete it.**

- [ ] Phase 1.1: Fix .env security (add to gitignore, delete file)
- [ ] Phase 1.2: Fix build failure (type annotation)
- [ ] Phase 1.3: Fix failing tests (update expectations)
- [ ] Verify: Build passes, all tests pass
- [ ] Phase 2.1: Add rate limiting to /api/chat
- [ ] Phase 2.2: Centralize Supabase client (create lib/supabase.ts)
- [ ] Phase 2.3: Replace sessionStorage with server-side persistence
- [ ] Verify: Build passes, all tests pass
- [ ] Phase 3.1: Add API route tests
- [ ] Phase 3.2: Add lib/rag.ts tests
- [ ] Phase 3.3: Add component tests
- [ ] Verify: All new tests pass
- [ ] Phase 4.1: Update README.md
- [ ] Phase 4.2: Fix console.log statements
- [ ] Phase 4.3: Fix font configuration
- [ ] Phase 4.4: Fix loading state model name
- [ ] Phase 5.1: Remove orphaned directories
- [ ] Phase 5.2: Exclude scripts from build
- [ ] Phase 5.3: Remove/implement calculator page
- [ ] Phase 6: Final verification (build, lint, test, git status)
- [ ] Phase 7: Create DEPLOYMENT_GUIDE.md
- [ ] Final: Review all changes, ensure nothing broken

---

## CHANGE LOG

**Keep a running log of every change you make:**

```markdown
## Changes Made

### Phase 1: Critical Security Fixes
- [Date/Time] Added .env to .gitignore
- [Date/Time] Deleted .env file (backed up to [location])
- [Date/Time] Fixed scripts/test_retrieval.ts type annotation
- [Date/Time] Updated parser.test.ts expectations to "NEEDS_REVIEW"

### Phase 2: High-Priority Improvements
- [Date/Time] Added rate limiting to /api/chat
- [Date/Time] Created lib/supabase.ts with centralized clients
- [Date/Time] Replaced sessionStorage with Supabase persistence

... continue for all phases ...
```

---

## SUCCESS CRITERIA

**You are DONE when ALL of these are true:**

✅ Build passes: `npm run build` exits with code 0  
✅ Lint passes: `npm run lint` shows no errors  
✅ All tests pass: `npm test` shows 100% pass rate  
✅ .env is gitignored and deleted  
✅ Rate limiting works on both API routes  
✅ Supabase client is centralized  
✅ Results persist on page refresh  
✅ Comprehensive test coverage added  
✅ README.md is project-specific  
✅ DEPLOYMENT_GUIDE.md exists with clear instructions  
✅ No orphaned files or directories  
✅ Console.log replaced with logger  
✅ All configurations are correct  

---

## FINAL DELIVERABLE

**When complete, provide the user with:**

1. **Summary of Changes**: High-level overview of what was fixed/added
2. **Test Results**: Output from `npm run build`, `npm run lint`, `npm test`
3. **File Changes**: List of files created, modified, deleted
4. **Next Steps**: Point user to DEPLOYMENT_GUIDE.md
5. **Known Limitations**: Any P2/P3 items not implemented (with justification)

---

## Remember

- **Security first, always**
- **Test after every change**
- **Never break working code**
- **Document everything**
- **Verify before moving on**

Begin Phase 1 now. Work systematically through each phase. Do not skip ahead.
