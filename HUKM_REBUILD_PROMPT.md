# HUKM - Complete Application Rebuild Prompt

You are tasked with building **HUKM** (Ethiopian Sentencing Assistant) - a production-ready RAG-powered legal analysis application from scratch.

## 🎯 Mission

Build a complete Next.js application that:
1. Retrieves Ethiopian law articles from a Supabase vector database
2. Uses NVIDIA AI APIs to provide structured legal analysis
3. Supports multi-turn conversations with full context
4. Provides source transparency with article citations
5. Implements comprehensive testing and production-ready features

---

## 📋 What You're Building

**HUKM** is an AI-assisted legal analysis tool for Ethiopian criminal law. Users describe a criminal scenario, and the system:
- Embeds the query using NVIDIA embeddings API
- Retrieves relevant law articles from Supabase pgvector
- Generates a structured 7-step legal analysis using NVIDIA chat models
- Provides confidence ratings and source citations
- Allows multi-turn conversations for follow-up questions

---

## 🔒 Critical Constraints

**YOU MUST preserve these exactly:**

### Database Schema (DO NOT MODIFY)
The Supabase database is already set up with:


**Tables:**
- `law_chunks` - Stores law articles with 1024-dim embeddings
  - id (BIGSERIAL PRIMARY KEY)
  - document_name (TEXT)
  - article_reference (TEXT)
  - content (TEXT)
  - metadata (JSONB)
  - embedding (VECTOR(1024))
  
- `conversations` - Multi-turn chat sessions
  - id (UUID PRIMARY KEY)
  - session_id (TEXT)
  - user_id (TEXT, nullable)
  - scenario_description (TEXT)
  - model_id (TEXT)
  - confidence_level (TEXT)
  - is_civil_matter (BOOLEAN)
  - needs_clarification (BOOLEAN)
  - created_at, updated_at (TIMESTAMPTZ)

- `messages` - Individual messages in conversations
  - id (UUID PRIMARY KEY)
  - conversation_id (UUID, FK to conversations)
  - role (TEXT: 'user', 'assistant', 'system')
  - content (TEXT)
  - metadata (JSONB)
  - created_at (TIMESTAMPTZ)

- `analysis_results` - Persisted analysis results
  - id (UUID PRIMARY KEY)
  - session_id (TEXT)
  - scenario_input (JSONB)
  - result (JSONB)
  - model_id (TEXT)
  - created_at (TIMESTAMPTZ)

**RPC Functions:**
- `match_law_chunks(query_embedding VECTOR(1024), match_threshold FLOAT, match_count INT)` - Returns similar law chunks
- `get_recent_conversations(p_session_id TEXT, p_limit INT)` - Returns user's conversations
- `get_conversation_messages(p_conversation_id UUID)` - Returns messages in a conversation

### External APIs (DO NOT MODIFY)

**NVIDIA Embeddings API:**
- Endpoint: `https://integrate.api.nvidia.com/v1/embeddings`
- Model: `nvidia/nv-embedqa-e5-v5`
- Returns: 1024-dimensional vectors
- Input types: "passage" (for documents), "query" (for search)

**NVIDIA Chat API:**
- Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
- Models available:
  - Primary: `z-ai/glm5`, `z-ai/glm4.7` (recommended, free)
  - Fallback: `meta/llama-4-maverick-17b-128e-instruct`, `meta/llama-3.1-405b-instruct`, `meta/llama-3.3-70b-instruct`, `deepseek-ai/deepseek-v3.2`, `mistralai/mistral-large-3-675b-instruct-2512`

---

## 🏗️ Core Architecture

### Technology Stack (Your Choice)
- **Framework**: Modern web framework (Next.js 14+ recommended, but you choose)
- **Language**: TypeScript (strict mode)
- **Styling**: Your choice (Tailwind CSS recommended)
- **Database Client**: Supabase JS client
- **Testing**: Your choice of testing framework
- **State Management**: Your choice

### Required Features

#### 1. RAG Pipeline
**Embedding Function:**
- Takes text input and returns 1024-dim vector
- Uses NVIDIA embeddings API
- Supports "passage" and "query" input types
- L2-normalizes vectors for cosine similarity

**Retrieval Function:**
- Embeds user query
- Calls `match_law_chunks()` RPC
- Two-stage retrieval:
  - Primary: threshold 0.3 (high-quality matches)
  - Fallback: threshold 0.0 if primary returns nothing
- Returns up to 8 chunks
- Deduplicates near-identical chunks (Jaccard similarity >0.9)

**Deduplication:**
- Calculate text similarity using Jaccard index on word sets
- Remove chunks with >90% similarity to already-selected chunks
- Preserve highest-similarity chunk in each duplicate group

#### 2. System Prompts

**Analysis Prompt (for /api/analyze):**
Must enforce:
- 7-step legal reasoning framework
- Strict JSON output matching AnalysisResult schema
- Anti-hallucination rules (never invent article numbers)
- Confidence level assignment (HIGH/MEDIUM/LOW/NEEDS_REVIEW)
- Civil matter detection
- Clarification protocol
- Retrieved law articles injection with quality assessment

**Chat Prompt (for /api/chat):**
Must enforce:
- Conversational, natural language responses (NOT JSON)
- Reference to prior analysis context
- Citation of specific articles when relevant
- Acknowledgment of uncertainty
- Ethiopian criminal law scope only

#### 3. Response Parsing
**Parser must:**
- NEVER throw errors (always return valid result)
- Strip markdown code fences
- Parse JSON safely
- Validate all required fields
- Provide fallback values for missing fields
- Default confidence to "NEEDS_REVIEW" on parse failure

#### 4. API Endpoints

**POST /api/analyze**
- Validates scenario input (10-5000 chars)
- Validates model ID
- Rate limiting (10 req/min for premium, 30 req/min for fallback)
- Retrieves law chunks
- Builds analysis prompt
- Calls NVIDIA chat API
- Parses response
- Persists to `analysis_results` table
- Returns: `{ success, resultId, result, modelId, retrievedChunks }`
- **BONUS**: Support streaming mode with NDJSON output

**POST /api/chat**
- Validates message (1-5000 chars)
- Validates conversation ID exists and belongs to session
- Rate limiting (same as analyze)
- Loads conversation history (last 20 messages)
- Retrieves law chunks for current message
- Builds chat prompt
- Calls NVIDIA chat API with full history
- Saves user + assistant messages
- Returns: `{ success, conversationId, messageId, response, retrievedChunks }`
- **BONUS**: Support streaming mode with NDJSON output

**POST /api/conversations** (create new conversation)
- Creates conversation record
- Links to analysis result if provided
- Returns conversation ID

#### 5. Session Management
- HTTP-only cookies
- 30-day expiration
- Unique session ID per browser
- Used for conversation ownership

#### 6. Rate Limiting
- In-memory Map-based (Redis-swappable interface)
- Separate limits for premium vs fallback models
- Applied to BOTH /api/analyze and /api/chat
- Returns 429 with retry-after header when exceeded
- Bucket key: IP address + model ID

---

## 📐 7-Step Legal Analysis Framework

The AI must output JSON with these exact fields:

\`\`\`typescript
interface AnalysisResult {
  // 7-step reasoning
  step1FactIdentification: string;
  step2LegalClassification: string;
  step3ElementsAnalysis: string;
  step4DefensesAndMitigation: string;
  step5SentencingFramework: string;
  step6PrecedentApplication: string;
  step7Conclusion: string;
  
  // Punishment & confidence
  estimatedPunishment: string;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "NEEDS_REVIEW";
  confidenceReason: string;
  
  // Procedural guidance
  proceduralRoadmap: string;
  disclaimer: string;
  
  // Special cases
  isCivilMatter: boolean;
  civilExplanation?: string;
  needsClarification: boolean;
  clarifyingQuestions?: string[];
  
  // Debug
  rawResponse: string;
}
\`\`\`

**Confidence Level Rules:**
- **HIGH**: ≥3 chunks with similarity ≥70%, direct punishment provisions, no ambiguities
- **MEDIUM**: 1-2 strong chunks OR ≥3 moderate chunks (50-70%), some interpretation needed
- **LOW**: No strong matches OR significant legal gaps OR uncertain article numbers
- **NEEDS_REVIEW**: Parse failure or response format error

---

## 🎨 User Interface (Your Design)

You have complete freedom to design the UI, but it MUST include:

### Home Page
- Model selector dropdown (all available models)
- Scenario description textarea (10-5000 chars)
- Language selector (English/Amharic)
- Optional: Crime category, severity/intent/history sliders
- Submit button
- Clear validation messages

### Results Page (`/results/[id]`)
- Fetch from `analysis_results` table by ID
- Display all 7 steps clearly
- Show confidence badge with reason
- Display estimated punishment
- Show procedural roadmap
- List retrieved law articles with similarity scores
- "Continue Conversation" button → creates conversation → redirects to chat

### Chat Page (`/chat/[conversationId]`)
- Load conversation history
- Display messages (user/assistant)
- Message input (1-5000 chars)
- Send button
- Show retrieved articles for each turn
- Auto-scroll to latest message

### Design Requirements:
- Mobile-responsive
- Accessible (WCAG AA minimum)
- Clear visual hierarchy
- Loading states for API calls
- Error states with retry options
- Professional, trustworthy appearance

---

## 🧪 Testing Requirements

**YOU MUST implement comprehensive tests:**

### Unit Tests
- RAG functions (embed, retrieve, deduplicate, similarity)
- Parser (JSON parsing, fallbacks, validation)
- Rate limiter (limits, windows, tiers)
- System prompt builder
- Model registry helpers

### Integration Tests
- `/api/analyze` endpoint (mock NVIDIA + Supabase)
- `/api/chat` endpoint (mock NVIDIA + Supabase)
- Session management
- Rate limiting enforcement

### Component Tests
- Scenario form (validation, submission)
- Analysis result display
- Chat interface (message sending, display)
- Model selector
- Confidence badge

### E2E Tests (Optional but Recommended)
- Full user flow: submit scenario → view results → continue conversation
- Rate limiting behavior
- Error handling

**Test Coverage Goal**: >80% for critical paths

---

## 🔐 Security Requirements

**YOU MUST implement:**

1. **Environment Variable Validation**
   - Check all required vars on startup
   - Provide helpful error messages
   - Never expose service role key to client

2. **Input Validation**
   - Sanitize all user inputs
   - Validate lengths, types, formats
   - Prevent injection attacks

3. **Rate Limiting**
   - Enforce on both analyze and chat endpoints
   - Return proper 429 responses
   - Include retry-after headers

4. **Session Security**
   - HTTP-only cookies
   - Secure flag in production
   - SameSite=Lax
   - Verify ownership before operations

5. **Database Security**
   - Use service role only on server
   - Never expose service key to browser
   - Validate conversation ownership
   - Use parameterized queries

---

## 📦 Required Environment Variables

\`\`\`bash
# NVIDIA API
NVIDIA_API_KEY=nvapi-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional
REDIS_URL=redis://localhost:6379  # For production rate limiting
SENTRY_DSN=...  # For error monitoring
\`\`\`

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure
1. Set up project with chosen framework
2. Configure TypeScript (strict mode)
3. Set up Supabase client (server + browser)
4. Implement session management
5. Create type definitions

### Phase 2: RAG Pipeline
1. Implement embedding function
2. Implement retrieval function
3. Implement deduplication
4. Test with real database

### Phase 3: AI Integration
1. Implement system prompt builders
2. Implement NVIDIA chat client
3. Implement response parser
4. Test with real API

### Phase 4: API Endpoints
1. Build /api/analyze (buffered)
2. Build /api/chat (buffered)
3. Implement rate limiting
4. Add streaming support (bonus)

### Phase 5: User Interface
1. Design and build home page
2. Build results page
3. Build chat page
4. Add loading/error states
5. Make responsive

### Phase 6: Testing
1. Write unit tests
2. Write integration tests
3. Write component tests
4. Write E2E tests (optional)

### Phase 7: Polish
1. Add proper error handling
2. Optimize performance
3. Add logging
4. Write documentation
5. Create deployment guide

---

## ✅ Success Criteria

Your rebuild is complete when:

- ✅ All API endpoints work correctly
- ✅ RAG pipeline retrieves and ranks articles accurately
- ✅ AI generates structured 7-step analyses
- ✅ Multi-turn conversations maintain context
- ✅ Rate limiting enforces limits properly
- ✅ Sessions persist across page refreshes
- ✅ Results persist in database
- ✅ UI is responsive and accessible
- ✅ All tests pass (>80% coverage)
- ✅ Build succeeds with no errors
- ✅ Lint passes with no warnings
- ✅ Documentation is complete

---

## 📚 Key Business Logic to Preserve

### Confidence Level Assignment
The system prompt must enforce these rules for assigning confidence:
- HIGH: ≥3 strong matches (≥70% similarity) + explicit punishment provisions
- MEDIUM: 1-2 strong OR ≥3 moderate matches (50-70%)
- LOW: Weak matches (<50%) OR significant gaps
- NEEDS_REVIEW: Parse failure or format error

### Anti-Hallucination Rules
The system prompt MUST enforce:
- Never invent article numbers
- Never contradict retrieved text
- Always acknowledge uncertainty
- Admit ignorance rather than guess
- Never extrapolate beyond retrieved text

### Two-Stage Retrieval
1. Try threshold 0.3 first (high-quality)
2. If empty, retry at threshold 0.0 (expose weak matches)
3. System prompt adjusts confidence based on match quality

### Deduplication Algorithm
- Calculate Jaccard similarity on word sets (ignore words <3 chars)
- Remove chunks with >90% similarity
- Keep highest-similarity chunk in each group

---

## 🎁 Bonus Features (Optional)

If you have time, add these:

1. **Streaming Responses**
   - NDJSON streaming for /api/analyze
   - NDJSON streaming for /api/chat
   - Live token-by-token display in UI

2. **Conversation History Page**
   - List recent conversations
   - Search/filter conversations
   - Resume any past conversation

3. **Advanced Features**
   - Export analysis as PDF
   - Share analysis via link
   - Amharic language support in UI
   - Dark mode

4. **Production Hardening**
   - Redis-backed rate limiter
   - Sentry error monitoring
   - Structured logging (Pino)
   - Performance monitoring

---

## 📖 Documentation Requirements

**YOU MUST create:**

1. **README.md**
   - Project description
   - Features list
   - Tech stack
   - Setup instructions
   - Environment variables
   - Running the app
   - Testing
   - Deployment

2. **ARCHITECTURE.md**
   - System architecture diagram
   - Data flow diagrams
   - Component relationships
   - API documentation

3. **DEPLOYMENT_GUIDE.md**
   - Local setup steps
   - Testing instructions
   - Production deployment
   - Environment configuration

4. **API_DOCUMENTATION.md**
   - All endpoints
   - Request/response formats
   - Error codes
   - Rate limits

---

## 🚨 Common Pitfalls to Avoid

1. **Don't modify the database schema** - It's already populated with law data
2. **Don't change NVIDIA API endpoints** - They're fixed
3. **Don't skip rate limiting** - It's critical for production
4. **Don't expose service role key** - Keep it server-side only
5. **Don't skip input validation** - Prevent injection attacks
6. **Don't hardcode model IDs** - Use the model registry
7. **Don't let parser throw** - Always return valid result
8. **Don't skip deduplication** - Prevents redundant chunks
9. **Don't forget L2 normalization** - Required for cosine similarity
10. **Don't skip tests** - They catch regressions

---

## 🎯 Final Checklist

Before you're done, verify:

- [ ] All environment variables documented
- [ ] Database connection works
- [ ] NVIDIA API integration works
- [ ] RAG pipeline retrieves articles
- [ ] Analysis generates 7-step output
- [ ] Chat maintains conversation context
- [ ] Rate limiting enforces limits
- [ ] Sessions persist correctly
- [ ] Results persist in database
- [ ] UI is responsive on mobile
- [ ] All forms validate input
- [ ] Error states show helpful messages
- [ ] Loading states prevent double-submission
- [ ] Tests pass (>80% coverage)
- [ ] Build succeeds
- [ ] Lint passes
- [ ] README is complete
- [ ] Deployment guide exists

---

## 🚀 Ready to Build?

You now have everything you need to rebuild HUKM from scratch. Focus on:
1. **Correctness** - Preserve the core business logic
2. **Quality** - Write clean, testable code
3. **UX** - Design an intuitive, professional interface
4. **Testing** - Comprehensive test coverage
5. **Documentation** - Clear, complete docs

**Start with Phase 1 and work systematically through each phase.**

Good luck! 🎉
