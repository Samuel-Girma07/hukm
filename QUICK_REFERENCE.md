# HUKM Rebuild - Quick Reference Card

## 🎯 One-Minute Overview

**What**: Rebuild HUKM (Ethiopian Sentencing Assistant) from scratch  
**Keep**: Database schema, NVIDIA APIs, core business logic  
**Change**: Everything else (UI, architecture, code organization)  
**Goal**: Production-ready RAG-powered legal analysis app  

---

## 📁 Files You Need

| File | Use It For |
|------|------------|
| `HUKM_REBUILD_PROMPT.md` | Give to AI or use as spec |
| `REBUILD_USAGE_GUIDE.md` | How to use the prompt |
| `REBUILD_SUMMARY.md` | Package overview |
| `QUICK_REFERENCE.md` | This cheat sheet |

---

## 🚀 Quick Start (30 seconds)

```bash
# Option 1: AI-Assisted
1. Open HUKM_REBUILD_PROMPT.md
2. Copy all content
3. Paste into AI (Claude/GPT-4)
4. Say: "Build this app"

# Option 2: Manual
1. Read HUKM_REBUILD_PROMPT.md
2. Follow Phase 1 → Phase 7
3. Check off items as you go
```

---

## 🔒 What You CANNOT Change

❌ Database schema (law_chunks, conversations, messages, analysis_results)  
❌ NVIDIA API endpoints (embeddings, chat)  
❌ Model IDs (glm4.7, llama, deepseek, etc.)  
❌ 7-step framework structure  
❌ Confidence level rules (HIGH/MEDIUM/LOW/NEEDS_REVIEW)  
❌ Anti-hallucination rules  
❌ RAG pipeline logic (embed → retrieve → deduplicate)  

---

## 🎨 What You CAN Change

✅ UI/UX design (complete freedom)  
✅ Component architecture  
✅ Styling approach (Tailwind/CSS/etc.)  
✅ Framework choice (Next.js recommended)  
✅ Testing framework  
✅ State management  
✅ Code organization  
✅ File structure  

---

## 📐 Core Specifications

### Database Tables
```
law_chunks          → Law articles with embeddings (1024-dim)
conversations       → Multi-turn chat sessions
messages            → Individual messages
analysis_results    → Persisted analysis results
```

### API Endpoints
```
POST /api/analyze   → Single-shot analysis (returns resultId)
POST /api/chat      → Multi-turn conversation
POST /api/conversations → Create new conversation
```

### System Prompts
```
Analysis Prompt     → Strict JSON output, 7-step framework
Chat Prompt         → Conversational, natural language
```

### Rate Limits
```
Premium models      → 10 requests/minute
Fallback models     → 30 requests/minute
```

---

## 🧪 Testing Requirements

| Type | Coverage | Examples |
|------|----------|----------|
| Unit | Core functions | RAG, parser, rate limiter |
| Integration | API routes | /analyze, /chat |
| Component | UI components | Forms, results, chat |
| E2E | User flows | Submit → Results → Chat |

**Goal**: >80% coverage

---

## 📊 7-Step Framework

```typescript
1. step1FactIdentification      → Identify key facts
2. step2LegalClassification     → Classify the crime
3. step3ElementsAnalysis        → Analyze elements
4. step4DefensesAndMitigation   → Identify defenses
5. step5SentencingFramework     → Sentencing range
6. step6PrecedentApplication    → Apply precedents
7. step7Conclusion              → Final conclusion

+ estimatedPunishment
+ confidenceLevel (HIGH/MEDIUM/LOW/NEEDS_REVIEW)
+ confidenceReason
+ proceduralRoadmap
+ disclaimer
```

---

## 🎯 Confidence Rules

| Level | Criteria |
|-------|----------|
| **HIGH** | ≥3 chunks with ≥70% similarity + explicit punishment |
| **MEDIUM** | 1-2 strong OR ≥3 moderate (50-70%) matches |
| **LOW** | Weak matches (<50%) OR significant gaps |
| **NEEDS_REVIEW** | Parse failure or format error |

---

## 🔐 Security Checklist

- [ ] Validate all environment variables
- [ ] Sanitize all user inputs
- [ ] Enforce rate limiting
- [ ] Use HTTP-only cookies
- [ ] Never expose service role key to client
- [ ] Verify conversation ownership
- [ ] Use parameterized queries

---

## ⏱️ Timeline

| Phase | Days | What |
|-------|------|------|
| 1-3 | 2-3 | Infrastructure + RAG + AI |
| 4 | 1-2 | API Endpoints |
| 5 | 2-3 | User Interface |
| 6 | 1-2 | Testing |
| 7 | 1 | Polish |
| **Total** | **7-12** | **Complete rebuild** |

---

## ✅ Done When...

- [ ] APIs work
- [ ] RAG retrieves articles
- [ ] AI generates analyses
- [ ] Conversations persist
- [ ] Rate limiting works
- [ ] Sessions persist
- [ ] Results persist
- [ ] UI is responsive
- [ ] Tests pass (>80%)
- [ ] Build succeeds
- [ ] Lint passes
- [ ] Docs complete

---

## 🎁 Bonus Features

- Streaming responses (NDJSON)
- Conversation history page
- Export to PDF
- Dark mode
- Redis rate limiter
- Sentry monitoring

---

## 🚨 Common Mistakes

1. ❌ Modifying database schema
2. ❌ Changing NVIDIA endpoints
3. ❌ Skipping rate limiting
4. ❌ Exposing service role key
5. ❌ Letting parser throw errors
6. ❌ Skipping deduplication
7. ❌ Forgetting L2 normalization
8. ❌ Hardcoding model IDs
9. ❌ Skipping input validation
10. ❌ Not testing as you go

---

## 💡 Pro Tips

1. ✅ Start with Phase 1
2. ✅ Test continuously
3. ✅ Follow TypeScript types
4. ✅ Preserve business logic
5. ✅ Don't modify database
6. ✅ Keep APIs unchanged
7. ✅ Focus on UX
8. ✅ Document everything

---

## 📞 Need Help?

**Check these files in the original codebase:**
- Database: `supabase-setup.sql`, `supabase-conversations-setup.sql`
- RAG: `lib/rag.ts`
- AI: `lib/nvidia.ts`
- Prompts: `lib/systemPrompt.ts`
- Parser: `lib/parser.ts`
- Types: `lib/types.ts`

---

## 🎉 You're Ready!

**Main file**: `HUKM_REBUILD_PROMPT.md`  
**Action**: Give to AI or use as spec  
**Result**: Complete production-ready app  

Good luck! 🚀
