# Hukm Technical Quality Audit

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Missing ARIA roles on custom components (Language Toggle, Chat) |
| 2 | Performance | 3 | Chat stream re-renders on every delta; otherwise lean |
| 3 | Responsive Design | 2 | Fixed-height ChatInterface breaks on mobile viewports |
| 4 | Theming | 1 | Hard-coded Tailwind colors (`blue-600`) used extensively |
| 5 | Anti-Patterns | 1 | High "AI Slop" tells: default Geist fonts, blue-on-gray SaaS palette |
| **Total** | | **9/20** | **Poor (Major Overhaul Needed)** |

## Anti-Patterns Verdict
**FAIL.** The interface currently looks like a generic AI-generated boilerplate (circa 2024). 
- **AI tells**: Cyan/Blue-on-dark/gray palette, repetitive rounded cards, Geist system fonts, "Hero metric" style confidence badge.
- **Design Drift**: Does not align with the requested **Formal Legal** or **Ethiopian Inspired** design context.

## Executive Summary
- Audit Health Score: **9/20** (Poor)
- Total issues found: 14 (P0: 3, P1: 5, P2: 4, P3: 2)
- Top critical issues:
  1. Hard-coded branding colors instead of design tokens (Ethiopian context missing).
  2. Generic typography (Geist) fails to evoke "Formal Legal" authority.
  3. Accessibility gaps in custom interactive elements (Toggle, Chat).
- Recommended next steps: Standardize tokens, upgrade typography, and refactor the card-heavy layout into a document-inspired structure.

---

## Detailed Findings by Severity

### [P0] Hard-coded Branding (AI Slop / Theming)
- **Location**: `components/ScenarioForm.tsx`, `components/StepCard.tsx`, `components/ChatInterface.tsx`
- **Category**: Theming / Anti-Pattern
- **Impact**: Prevents the tool from feeling like a specific Ethiopian legal brand; looks like any generic GPT wrapper.
- **Recommendation**: Define OKLCH tokens for Ethiopian-inspired greens and golds in `tailwind.config.ts`.
- **Suggested command**: `/colorize`

### [P0] Generic Typography (Anti-Pattern)
- **Location**: `app/layout.tsx`, `app/globals.css`
- **Category**: Anti-Pattern
- **Impact**: Geist Sans is a developer-centric font; it lacks the "gravity" and "authority" of a legal tool.
- **Recommendation**: Implement a serif/sans pairing (e.g., a formal serif for legal text and a clean sans for UI).
- **Suggested command**: `/typeset`

### [P0] Fixed Height Chat (Responsive)
- **Location**: `components/ChatInterface.tsx` (line 155: `h-[600px]`)
- **Category**: Responsive
- **Impact**: Chat container overflows or cuts off on mobile devices.
- **Recommendation**: Use fluid height or viewport-relative units with sensible min-height.
- **Suggested command**: `/adapt`

### [P1] Missing ARIA on Custom Toggle (Accessibility)
- **Location**: `components/ScenarioForm.tsx` (line 70: Language Toggle)
- **Category**: Accessibility
- **Impact**: Screen readers cannot identify the purpose or state of the language switch.
- **Recommendation**: Add `role="switch"` and `aria-checked` attributes.
- **Suggested command**: `/harden`

### [P1] Card-Heavy Layout (Anti-Pattern)
- **Location**: `components/AnalysisResult.tsx`, `components/StepCard.tsx`
- **Category**: Anti-Pattern
- **Impact**: "Cards inside cards" creates visual noise and feels like a generic dashboard.
- **Recommendation**: Flatten the hierarchy; use typographic separation or subtle borders instead of multiple rounded shadow-cards.
- **Suggested command**: `/distill`

### [P1] Missing aria-live in Chat Stream (Accessibility)
- **Location**: `components/ChatInterface.tsx`
- **Category**: Accessibility
- **Impact**: Screen readers don't announce incoming AI messages as they stream.
- **Recommendation**: Wrap message container in an `aria-live="polite"` region.
- **Suggested command**: `/harden`

### [P1] Small Touch Targets (Responsive)
- **Location**: `components/ScenarioForm.tsx` (Language toggle, Sliders)
- **Category**: Responsive
- **Impact**: Difficult to use on mobile devices for users with limited motor precision.
- **Recommendation**: Ensure interactive areas are at least 44x44px.
- **Suggested command**: `/adapt`

### [P2] Pure White Background (Theming)
- **Location**: `app/globals.css`, `components/StepCard.tsx`
- **Category**: Theming
- **Impact**: Stark white is harsh and doesn't evoke "Formal Legal" paper quality.
- **Recommendation**: Use ivory or cream tints (`oklch`) for backgrounds.
- **Suggested command**: `/colorize`

### [P2] Inefficient Chat Rendering (Performance)
- **Location**: `components/ChatInterface.tsx` (consumeNdjsonStream)
- **Category**: Performance
- **Impact**: Updates state for every character delta, causing high CPU usage during long streams.
- **Recommendation**: Buffer deltas (e.g., every 50ms) before triggering state updates.
- **Suggested command**: `/optimize`

---

## Positive Findings
- **Server/Client Hygiene**: Excellent separation of Supabase service role and anon keys.
- **Error Handling**: Robust `parser.ts` ensures AI JSON failures don't crash the UI.
- **Semantic Tags**: Good use of `<main>`, `<nav>`, and `<form>` tags.

---

## Recommended Actions

1. **[P0] `/typeset`** — Replace Geist fonts with a formal serif (headings) and clean sans (UI) pairing to establish legal authority.
2. **[P0] `/colorize`** — Replace hard-coded Tailwind blues with Ethiopian-inspired design tokens (deep green, muted gold) and ivory "paper" backgrounds.
3. **[P0] `/adapt`** — Remove fixed heights in ChatInterface and increase touch target sizes for mobile users.
4. **[P1] `/harden`** — Add ARIA roles to custom toggles and `aria-live` regions to the chat interface.
5. **[P1] `/distill`** — Refactor AnalysisResult to remove nested cards and simplify the visual hierarchy.
6. **[P2] `/optimize`** — Implement delta-buffering in ChatInterface to reduce re-render frequency.
7. **`/polish`** — Final pass for alignment and micro-interactions.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/audit` after fixes to see your score improve.
