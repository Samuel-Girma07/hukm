# How to Use the HUKM Rebuild Prompt

## What I Created

I've created **`HUKM_REBUILD_PROMPT.md`** - a comprehensive specification for rebuilding the entire HUKM application from scratch while preserving the database and APIs.

## What's Included

### ✅ Preserved (DO NOT CHANGE)
- **Database Schema**: Complete Supabase table structures, indexes, RPC functions
- **NVIDIA APIs**: Embeddings and chat endpoints, model IDs, authentication
- **Core Business Logic**: 7-step framework, confidence rules, anti-hallucination rules
- **RAG Pipeline**: Embedding, retrieval, deduplication algorithms

### 🎨 Freedom to Redesign
- **UI/UX**: Complete freedom to design modern, accessible interface
- **Technology Stack**: Choose your preferred framework (Next.js recommended)
- **Component Architecture**: Design your own component structure
- **Styling Approach**: Choose your CSS solution (Tailwind recommended)
- **Testing Framework**: Choose your testing tools
- **State Management**: Choose your state solution

## Key Sections in the Prompt

### 1. Critical Constraints
- Exact database schema with all tables and columns
- NVIDIA API endpoints and models
- RPC functions that must be used

### 2. Core Architecture
- RAG pipeline requirements
- System prompt specifications
- Response parsing rules
- API endpoint specifications

### 3. 7-Step Legal Analysis Framework
- Complete TypeScript interface
- Confidence level assignment rules
- Anti-hallucination enforcement

### 4. User Interface Requirements
- Required pages (home, results, chat)
- Must-have features
- Design freedom with constraints

### 5. Testing Requirements
- Unit tests (RAG, parser, rate limiter)
- Integration tests (API endpoints)
- Component tests (UI components)
- E2E tests (optional)

### 6. Security Requirements
- Environment variable validation
- Input sanitization
- Rate limiting
- Session security
- Database security

### 7. Implementation Phases
- 7 clear phases from infrastructure to polish
- Systematic approach
- Verification at each step

## How to Use This Prompt

### Option 1: Give to AI Assistant
```
Copy the entire HUKM_REBUILD_PROMPT.md and paste it into a conversation
with an AI assistant (Claude, GPT-4, etc.)

Then say: "Please build this application following the specifications."
```

### Option 2: Use as Development Spec
```
Use it as a comprehensive specification document for your development team.
Each section can be assigned to different developers.
```

### Option 3: Phased Implementation
```
Follow the 7 implementation phases in order:
1. Core Infrastructure
2. RAG Pipeline
3. AI Integration
4. API Endpoints
5. User Interface
6. Testing
7. Polish
```

## What the AI Will Build

### Core Features
✅ RAG-powered legal analysis with source citations  
✅ 7-step structured legal reasoning  
✅ Multi-turn conversations with context  
✅ Confidence level assessment  
✅ Rate limiting (10 req/min premium, 30 req/min fallback)  
✅ Session management with cookies  
✅ Result persistence in database  
✅ Mobile-responsive UI  
✅ Comprehensive testing (>80% coverage)  

### Technical Implementation
✅ Embedding function (NVIDIA API → 1024-dim vectors)  
✅ Two-stage retrieval (threshold 0.3 → 0.0 fallback)  
✅ Deduplication (Jaccard similarity >0.9)  
✅ System prompts (analysis JSON + chat conversational)  
✅ Response parser (never throws, always valid)  
✅ API endpoints (/api/analyze, /api/chat)  
✅ Supabase integration (server + browser clients)  

### Bonus Features (Optional)
🎁 Streaming responses (NDJSON)  
🎁 Conversation history page  
🎁 Export to PDF  
🎁 Dark mode  
🎁 Redis-backed rate limiter  
🎁 Sentry error monitoring  

## Expected Timeline

- **Phase 1-3** (Infrastructure + RAG + AI): ~2-3 days
- **Phase 4** (API Endpoints): ~1-2 days
- **Phase 5** (User Interface): ~2-3 days
- **Phase 6** (Testing): ~1-2 days
- **Phase 7** (Polish): ~1 day

**Total**: ~7-12 days for a complete rebuild

## Success Criteria

The rebuild is complete when:

✅ All API endpoints work correctly  
✅ RAG pipeline retrieves and ranks articles  
✅ AI generates structured analyses  
✅ Conversations maintain context  
✅ Rate limiting works  
✅ Sessions persist  
✅ Results persist in database  
✅ UI is responsive and accessible  
✅ Tests pass (>80% coverage)  
✅ Build succeeds  
✅ Lint passes  
✅ Documentation complete  

## What You'll Get

### Code
- Complete application source code
- All components and pages
- API routes
- Utility functions
- Test suites

### Documentation
- README.md (setup, features, usage)
- ARCHITECTURE.md (system design)
- DEPLOYMENT_GUIDE.md (deployment steps)
- API_DOCUMENTATION.md (endpoint specs)

### Tests
- Unit tests for all core functions
- Integration tests for API routes
- Component tests for UI
- E2E tests (optional)

## Key Differences from Original

### What's Preserved
- ✅ Exact same database schema
- ✅ Same NVIDIA API integration
- ✅ Same RAG pipeline logic
- ✅ Same 7-step framework
- ✅ Same confidence rules
- ✅ Same anti-hallucination rules

### What Can Change
- 🎨 UI design and layout
- 🎨 Component architecture
- 🎨 Styling approach
- 🎨 State management
- 🎨 Testing framework
- 🎨 Code organization

## Tips for Best Results

1. **Start with Phase 1**: Don't skip ahead
2. **Test as you go**: Don't wait until the end
3. **Follow the types**: TypeScript interfaces are your contract
4. **Preserve business logic**: The confidence rules and prompts are critical
5. **Don't modify the database**: It's already populated with law data
6. **Keep APIs unchanged**: NVIDIA endpoints are fixed
7. **Focus on UX**: Make it intuitive and professional
8. **Document everything**: Future you will thank you

## Common Questions

**Q: Can I use a different framework than Next.js?**  
A: Yes, but Next.js is recommended for its API routes and SSR capabilities.

**Q: Can I change the database schema?**  
A: No, the database is already populated with law data. Use it as-is.

**Q: Can I use different AI models?**  
A: No, the NVIDIA models are specified and must be used.

**Q: Can I redesign the UI completely?**  
A: Yes! You have complete freedom on UI/UX design.

**Q: Do I need to implement streaming?**  
A: No, it's optional (bonus feature). Buffered responses are fine.

**Q: What if I want to add new features?**  
A: Great! Add them after completing the core requirements.

---

## Ready to Rebuild?

The prompt is comprehensive and ready to use. Simply give it to an AI assistant or use it as a development specification.

**File**: `HUKM_REBUILD_PROMPT.md`

Good luck with your rebuild! 🚀
