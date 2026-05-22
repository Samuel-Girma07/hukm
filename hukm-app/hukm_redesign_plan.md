# HUKM — Redesign & Feature Addition Plan

> **Status**: Research & planning only — nothing applied yet.  
> **Date**: 2026-05-12

---

## Table of Contents

1. [Model Selector Redesign](#1-model-selector-redesign)
2. [New Features to Add](#2-new-features-to-add)
3. [File-by-File Change Map](#3-file-by-file-change-map)

---

## 1. Model Selector Redesign

### 1.1 Current State

The model selector currently shows **raw model names** (e.g. "Nemotron Super 120B", "GLM-5.1", "Llama 4 Maverick") with vendor logos and taglines like "NVIDIA flagship — fast". Users have no idea what these mean for their use case.

**Current `PRIMARY_MODELS` in [models.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/lib/models.ts):**

| Display Name | Model ID | Tagline |
|---|---|---|
| Nemotron Super 120B | `nvidia/nemotron-3-super-120b-a12b` | NVIDIA flagship — fast, balanced |
| GLM-5.1 | `z-ai/glm-5.1` | Latest Z.AI premium |
| Llama 4 Maverick | `meta/llama-4-maverick-17b-128e-instruct` | Meta flagship — fast |
| Qwen3.5 397B | `qwen/qwen3.5-397b-a17b` | Largest open Qwen |
| GPT-OSS 120B | `openai/gpt-oss-120b` | OpenAI open weights |

### 1.2 New Model Tier System

Replace model names with **user-friendly capability tiers**. Users pick a speed/quality tradeoff, not a model name.

| Tier Label | Icon Concept | Model ID (behind the scenes) | Tagline | Thinking Mode |
|---|---|---|---|---|
| **⚡ Fast** | Lightning bolt | `meta/llama-4-maverick-17b-128e-instruct` | Instant results, great for simple cases | `enable_thinking: false` |
| **⚡🧠 Fast Thinking** | Lightning + brain | `nvidia/nemotron-3-super-120b-a12b` | Fast with chain-of-thought reasoning | `enable_thinking: true, low_effort: true` |
| **🧠 Thinking Low** | Brain (1 bar) | `qwen/qwen3.5-397b-a17b` | Deep analysis, largest open model | `enable_thinking: true` |
| **🧠🧠 Thinking Medium** | Brain (2 bars) | `openai/gpt-oss-120b` | Thorough reasoning, OpenAI quality | `enable_thinking: true` |
| **🧠🧠🧠 Thinking High** | Brain (3 bars) | `z-ai/glm-5.1` | Maximum reasoning depth | `enable_thinking: true` |

### 1.3 NVIDIA API — Thinking Mode Configuration

> [!IMPORTANT]
> Research confirmed that thinking mode is controlled via `chat_template_kwargs` in the request body.

**For models that support thinking:**
```json
{
  "model": "nvidia/nemotron-3-super-120b-a12b",
  "messages": [...],
  "temperature": 0.1,
  "max_tokens": 4096,
  "stream": true,
  "chat_template_kwargs": {
    "enable_thinking": true
  }
}
```

**For "Fast Thinking" (low-effort reasoning):**
```json
{
  "chat_template_kwargs": {
    "enable_thinking": true,
    "low_effort": true
  }
}
```

**For GLM-5.1 (Z.AI):**
The codebase currently *disables* thinking for `z-ai/*` models. For "Thinking High", we should **enable** it instead.

> [!WARNING]
> When thinking is enabled, `max_tokens` should be increased significantly (4096–8192 minimum) because the model generates reasoning tokens before the final answer. The current default of 2048 may truncate thinking models.

### 1.4 UI Redesign Concept

**Replace the current model-name dropdown with a horizontal tier picker:**

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Fast  │  ⚡🧠 Fast   │  🧠 Low  │  🧠🧠 Med  │  🧠🧠🧠 High │
│           │  Thinking   │          │            │              │
│  Instant  │  Fast +     │  Deep    │  Thorough  │  Maximum     │
│  results  │  reasoning  │  analysis│  reasoning │  depth       │
└─────────────────────────────────────────────────────────┘
```

**For the compact variant** (in the composer toolbar), show a pill like:
```
[🧠 Thinking Medium ▾]
```

**Key changes:**
- Remove vendor logos from the primary selector (users don't care about Meta vs NVIDIA)
- Replace the `Pro` badge with a visual "thinking depth" indicator (1–3 brain icons or bars)
- Keep "Powered by NVIDIA" in the footer of the popover
- No model names shown to users at all — just tier labels
- The `ModelSelector` component changes from a name-based list to a segmented/tier-based picker

### 1.5 Data Model Changes in `lib/models.ts`

```typescript
// New type replacing the current ChatModel
export type ModelTier = "fast" | "fast_thinking" | "thinking_low" | "thinking_medium" | "thinking_high";

export interface ChatModel {
  id: string;                     // NVIDIA model ID (unchanged)
  tier: ModelTier;                // New primary identifier
  displayName: string;            // "Fast", "Fast Thinking", etc.
  tagline: string;                // Short description
  vendor: ModelVendor;            // Keep for internal tracking
  thinkingConfig: {
    enabled: boolean;
    lowEffort?: boolean;
  };
  maxTokens: number;              // Per-model max_tokens override
  rateLimitTier: "standard" | "premium";
}
```

### 1.6 Files That Need Changes

| File | Change |
|---|---|
| [lib/models.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/lib/models.ts) | Rewrite `PRIMARY_MODELS` with tier-based structure, add `thinkingConfig` |
| [lib/nvidia.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/lib/nvidia.ts) | Update `buildRequestBody` to use per-model `thinkingConfig` instead of hardcoded `z-ai/` check |
| [lib/ratelimit.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/lib/ratelimit.ts) | Update tier mapping for new model structure |
| [components/ModelSelector.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/ModelSelector.tsx) | Complete rewrite — segmented tier picker instead of name-based dropdown |
| [components/model-logos/VendorLogo.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/model-logos/VendorLogo.tsx) | Add tier icons (lightning, brain combos) alongside or replacing vendor logos |
| [components/AnalysisView.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/AnalysisView.tsx) | Show tier name instead of raw model name in results |
| [components/ChatInterface.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/ChatInterface.tsx) | Update context pane to show tier name |
| [components/CompareView.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/CompareView.tsx) | Update model display |
| [app/api/analyze/route.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/app/api/analyze/route.ts) | Update `streamFromCandidate` to use per-model thinking config instead of hardcoded `z-ai/` check; increase `max_tokens` for thinking models |
| [lib/translations/en.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/lib/translations/en.ts) | Add tier label translations |
| [lib/translations/am.ts](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/lib/translations/am.ts) | Add Amharic tier labels |

---

## 2. New Features to Add

Based on a complete audit of the codebase, here are the **key gaps and high-impact features** to add, ordered by priority:

### Priority 1 — Critical Gaps

#### 2.1 🔄 Markdown Rendering in Analysis Steps & Chat

**Problem**: The 7-step analysis steps and chat messages render as plain text (`whitespace-pre-wrap`). The AI often returns markdown (bold, lists, headers) that displays as raw syntax.

**Solution**: Add a lightweight markdown renderer (e.g. `react-markdown` + `remark-gfm`) to:
- [StepCard.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/StepCard.tsx) — analysis step bodies
- [MessageBubble.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/MessageBubble.tsx) — chat messages

**Files**: `StepCard.tsx`, `MessageBubble.tsx`, `package.json` (add `react-markdown`, `remark-gfm`)

---

#### 2.2 📊 Token Usage & Cost Display

**Problem**: No visibility into how many tokens each analysis consumes. Users and admins have no way to understand cost/usage.

**Solution**: 
- Return `usage.total_tokens` from NVIDIA responses (already available in the API response)
- Display token count on the results page as a subtle badge
- Track cumulative tokens in `usage_events` metadata
- Show token stats in the admin dashboard

**Files**: `route.ts` (analyze), `AnalysisView.tsx`, `AdminDashboard.tsx`, `lib/types.ts`

---

#### 2.3 🔍 Analysis History Search & Filtering

**Problem**: The [/history](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/app/history) page shows a flat list of past conversations. No search, no filtering by crime category, confidence level, or date range.

**Solution**:
- Add a search bar to filter by scenario text
- Add dropdown filters: crime category, confidence level, date range
- Add pagination (currently loads all at once)

**Files**: `HistoryList.tsx`, `app/api/conversations/route.ts`

---

### Priority 2 — High-Impact UX Improvements

#### 2.4 🎯 Multi-Model Comparison from Results Page

**Problem**: The Compare page requires manually pasting two scenarios. There's no way to re-run the same scenario with a different model directly from the results page.

**Solution**: Add a "Re-analyse with different model" button on `AnalysisView` that:
1. Pre-fills the same scenario
2. Lets user pick a different tier
3. Redirects to `/compare?a=<existing>&b=<new>`

**Files**: `AnalysisView.tsx`, `CompareView.tsx`

---

#### 2.5 📋 Scenario Templates Library

**Problem**: Only 3 hardcoded examples exist. Users often don't know how to phrase legal scenarios effectively.

**Solution**: Create a `/templates` page (or an expandable section on the home page) with 15–20 curated scenario templates organized by crime category:
- Homicide, Assault, Theft, Fraud, Drug offenses, etc.
- Each template has a title, description, and pre-filled scenario text
- Click to auto-fill the composer

**Files**: New `lib/scenarioTemplates.ts`, update `ScenarioForm.tsx`, optionally new `app/templates/page.tsx`

---

#### 2.6 📱 Mobile UX Improvements

**Problem**: Several mobile UX issues identified:
- The composer toolbar wraps awkwardly on small screens
- The sidebar drawer doesn't have swipe-to-close
- The results page has no sticky header for navigation
- Chat composer at the bottom overlaps content on iOS (safe area)

**Solution**:
- Add `env(safe-area-inset-bottom)` padding to the chat composer
- Implement touch swipe to close drawer
- Add a sticky mini-header on results pages for back navigation
- Responsive composer toolbar: collapse crime selector and sliders into a single "Options" popover on mobile

**Files**: `globals.css`, `ChatInterface.tsx`, `SiteSidebar.tsx`, `ScenarioForm.tsx`, `AnalysisView.tsx`

---

#### 2.7 🌐 Onboarding / First-Time User Tour

**Problem**: New users land on a blank composer with no guidance. The app has many features (sliders, crime selector, language toggle, compare, insights) that are not discoverable.

**Solution**: A lightweight step-by-step tooltip tour that triggers on first visit:
1. "Describe your legal scenario here"
2. "Pick a crime category for more accurate results"
3. "Choose analysis depth — Fast for quick answers, Thinking for deep analysis"
4. "Adjust context sliders for severity and intent"
5. "Press ⌘Enter to analyse"

Store `hasSeenTour` in localStorage / IndexedDB.

**Files**: New `components/OnboardingTour.tsx`, `app/page.tsx`, `lib/idb.ts`

---

### Priority 3 — Nice-to-Have Features

#### 2.8 📄 Export to Word (.docx)

**Problem**: PDF export exists but some lawyers prefer Word documents for editing.

**Solution**: Add a `.docx` export option alongside the existing PDF export using a lightweight library like `docx` (npm package).

**Files**: New `components/AnalysisDocx.tsx`, `AnalysisView.tsx`, `package.json`

---

#### 2.9 ⌨️ Keyboard Shortcuts Panel

**Problem**: The app has keyboard shortcuts (`/` to focus, `⌘Enter` to submit, `Esc` to cancel) but they're only mentioned as tiny hints. No discoverability.

**Solution**: The component [ShortcutsHelp.tsx](file:///c:/Users/KATANA/Documents/Law/hukm/hukm-app/components/ShortcutsHelp.tsx) already exists but appears unused. Wire it up:
- Add a `?` keyboard shortcut to open it
- Add a "Shortcuts" link in the sidebar
- Add missing shortcuts (e.g. `n` for new analysis)

**Files**: `ShortcutsHelp.tsx`, `SiteSidebar.tsx`, `app/layout.tsx`

---

#### 2.10 📊 Enhanced Admin Dashboard

**Problem**: The admin dashboard has basic stats. Missing:
- Analysis latency tracking (how long each model takes)
- Error rate tracking per model
- Rate limit hit frequency
- Retrieval quality distribution (similarity scores over time)

**Solution**: Extend `usage_events` metadata to track these metrics and add corresponding charts.

**Files**: `AdminDashboard.tsx`, `app/api/analyze/route.ts`, `lib/analytics.ts`

---

#### 2.11 🔗 Deep Linking to Analysis Steps

**Problem**: Can't share a link to a specific step of an analysis (e.g. "Step 5 — Sentencing Framework").

**Solution**: Add anchor IDs to each step card and update the URL hash on scroll/click.

**Files**: `StepCard.tsx`, `AnalysisView.tsx`

---

#### 2.12 🧹 Analysis Draft Auto-Save

**Problem**: If the user accidentally navigates away while typing a long scenario, everything is lost.

**Solution**: Auto-save draft scenario text to IndexedDB every 2 seconds. Restore on page load if a draft exists.

**Files**: `ScenarioForm.tsx`, `lib/idb.ts`

---

## 3. File-by-File Change Map

> [!NOTE]
> This is a summary of every file that will be touched. The model selector redesign is Phase 1; features are Phase 2+.

### Phase 1 — Model Selector Redesign

| File | Type | Changes |
|---|---|---|
| `lib/models.ts` | **Rewrite** | New `ChatModel` interface with tier/thinking config, rewrite `PRIMARY_MODELS`, update helpers |
| `lib/nvidia.ts` | **Edit** | `buildRequestBody` uses per-model `thinkingConfig`, increase `max_tokens` for thinking tiers |
| `app/api/analyze/route.ts` | **Edit** | `streamFromCandidate` — remove hardcoded `z-ai/` check, use model config; increase `max_tokens` |
| `components/ModelSelector.tsx` | **Rewrite** | Segmented tier picker UI (both `card` and `compact` variants) |
| `components/model-logos/VendorLogo.tsx` | **Edit** | Add tier-based icons (lightning, brain) |
| `components/AnalysisView.tsx` | **Edit** | Show tier name, not raw model name |
| `components/ChatInterface.tsx` | **Edit** | Update context pane model display |
| `components/CompareView.tsx` | **Edit** | Update model label display |
| `lib/ratelimit.ts` | **Edit** | Map new tier structure to rate limit config |
| `lib/translations/en.ts` | **Edit** | Add tier label strings |
| `lib/translations/am.ts` | **Edit** | Add Amharic tier labels |

### Phase 2 — Priority 1 Features

| File | Feature |
|---|---|
| `package.json` | Add `react-markdown`, `remark-gfm` |
| `components/StepCard.tsx` | Markdown rendering |
| `components/MessageBubble.tsx` | Markdown rendering |
| `app/api/analyze/route.ts` | Token usage tracking |
| `components/AnalysisView.tsx` | Token count badge |
| `components/HistoryList.tsx` | Search bar, filters, pagination |

### Phase 3 — Priority 2+ Features

| File | Feature |
|---|---|
| `lib/scenarioTemplates.ts` (new) | Template library |
| `components/OnboardingTour.tsx` (new) | First-time user guide |
| `components/AnalysisDocx.tsx` (new) | Word export |
| `components/ShortcutsHelp.tsx` | Wire up keyboard shortcut panel |
| `globals.css` | iOS safe area, mobile fixes |
| `components/SiteSidebar.tsx` | Shortcuts link, swipe-to-close |
| `components/ScenarioForm.tsx` | Draft auto-save, mobile toolbar |
| `components/AdminDashboard.tsx` | Enhanced metrics |

---

> [!TIP]
> **Recommended order of implementation:**
> 1. Model selector redesign (this is a self-contained, high-impact change)
> 2. Markdown rendering (quick win, dramatically improves readability)
> 3. Draft auto-save (prevents user frustration)
> 4. History search/filter (critical for repeat users)
> 5. Scenario templates (improves onboarding)
> 6. Everything else in parallel
