# HUKM — Onboarding Design Prompt for Google Stitch

## Project Overview

**HUKM** (ሕግም) is an AI-powered legal analysis engine for Ethiopian Criminal Law. It performs structured 7-step analysis of criminal law scenarios under Proclamation 414/2004. Think "Perplexity meets legal research" — minimal, dark, professional, and intellectually sophisticated.

**Website URL:** `https://hukm.app` (if available, reference the live site)

---

## Design System & Theme

### Theme: Dark Legal / Perplexity Pro Inspired
- **Always dark mode** — no light mode exists
- Background: `#0A0A0A` (primary), `#1C1C1E` (surface), `#2C2C2E` (elevated)
- Primary accent: `#0A84FF` (electric blue)
- Secondary accent: `#5AC8FA` (cyan)
- Tertiary accents: `#c084fc` (soft purple), `#FFD60A` (amber), `#30D158` (green), `#FF453A` (red)
- Borders: `rgba(255,255,255,0.08)` subtle, `rgba(255,255,255,0.14)` visible

### Typography
- **Hero/Display:** Sanchez (serif-like, editorial feel) — used for main heading
- **H2/Secondary headings:** BenchNine (condensed, authoritative)
- **Body/Everything else:** Slabo 13px (readable, slab serif)
- **Mono:** System mono stack (for code/technical bits)
- Single weight system (400 regular, 500 medium, 600 semibold only where needed)

### Visual Effects & Signature Elements
1. **LightRays** — Animated white light rays emanating from top-center, fading into the dark background (hero page only)
2. **BorderGlow** — Interactive glow effect on the composer card that follows mouse position with colors `[#5AC8FA, #0A84FF, #c084fc]`
3. **MetallicPaint** — Brushed metallic shimmer effect used on the HUKM logo mark
4. **AnimatedHeroText** — Typewriter-style stroke text animation for the subtitle

### Component Language
- Cards: 14px–18px border radius, subtle borders, glass-like surfaces
- Buttons: Pill-shaped (rounded-full) for primary actions, 40px height
- Inputs: 18px border radius, dark transparent backgrounds
- Badges: Pill-shaped with subtle background tints
- Icons: Lucide-style, 14–16px, muted color

---

## App Structure (What Users Can Do)

### 1. Home / Analysis Composer
- Large textarea for describing criminal law scenarios (10–5000 chars)
- **Crime Category selector** (homicide, assault, theft, fraud, drug offense, etc.)
- **Model Tier picker** — Horizontal segmented control:
  - ⚡ Fast (instant results)
  - ⚡🧠 Fast Thinking (speed + reasoning)
  - 🧠 Thinking Low (deep analysis)
  - 🧠🧠 Thinking Medium (thorough reasoning)
  - 🧠🧠🧠 Thinking High (maximum depth)
- **Context Sliders** — Severity (1–5), Intent (1–5), History (1–5)
- **Language Toggle** — English / አማርኛ (Amharic)
- Example scenario cards (3 suggestions)
- Submit via ⌘Enter or send button

### 2. Analysis Results (7 Steps)
After submitting, users see a 7-step structured analysis:
1. Fact Identification
2. Legal Classification
3. Elements of the Offence
4. Defences & Mitigation
5. Sentencing Framework
6. Precedent Application
7. Conclusion

Features on results page:
- Confidence badge (High/Medium/Low/Needs Review)
- Cited articles with source links
- Estimated punishment
- Procedural roadmap
- "Continue in chat" for follow-up questions
- Export as PDF
- Share publicly
- Compare with another scenario

### 3. Chat / Follow-up
- Persistent conversation thread per analysis
- Ask follow-up questions about the legal analysis
- Full chat interface with history sidebar

### 4. History
- All past analyses saved to browser session
- Search and filter conversations

### 5. Compare
- Side-by-side comparison of two scenarios
- See how different facts change the legal analysis

### 6. Insights
- Heatmap of most-cited Ethiopian Criminal Code articles
- Usage analytics

### 7. Resources
- Directory of legal aid organizations, law firms, courts in Ethiopia
- Filter by free/paid, language, specialization

---

## Onboarding Goals

New users land on the home page with a blank composer and no guidance. The app has many sophisticated features that aren't immediately discoverable. The onboarding should:

1. **Introduce HUKM's purpose** — What it is, what it does, why it's trustworthy
2. **Explain the composer** — How to write effective scenarios
3. **Showcase model tiers** — Help users pick the right analysis depth
4. **Demonstrate sliders & options** — Crime category, severity, intent, history
5. **Highlight keyboard shortcuts** — `/` to focus, `⌘Enter` to submit, `Esc` to cancel
6. **Preview the 7-step analysis** — What happens after they submit
7. **Mention follow-up features** — Chat, history, compare, PDF export
8. **Set trust expectations** — "AI-generated, not legal advice. Consult a licensed advocate."

---

## Onboarding Flow Requirements

### Flow Options (Designer's Choice)

**Option A: Interactive Tooltip Tour**
- Step-by-step tooltips that highlight each UI element
- Triggered automatically on first visit
- Progress indicator (Step 1 of 5)
- Can skip or restart later

**Option B: Hero Walkthrough Cards**
- 3–4 full-width cards above the composer on first visit
- Each card explains a key concept with illustration/icon
- Dismissible, with "Don't show again" option

**Option C: Mixed Modal + Highlight Tour**
- Welcome modal on first visit with value proposition
- Then subtle pulsing highlights on key UI elements
- Clicking a highlight opens a tooltip explanation

**Option D: Progressive Onboarding**
- Minimal initial prompt
- Contextual tips appear as user interacts (e.g., first time clicking model selector, show model tier explanation)

### Design Preferences

- **Dark theme only** — all onboarding elements must fit the dark aesthetic
- **Premium feel** — should feel like a high-end legal/professional tool, not a consumer app
- **Respectful of user time** — lawyers and legal professionals are busy; get to the point
- **Multilingual awareness** — The app supports English and Amharic. Onboarding should work in both (start with English)
- **Accessible** — WCAG AA compliant, keyboard navigable, screen reader friendly
- **Dismissible & Resumable** — Users can skip and restart the tour from the sidebar help menu

### Specific Elements to Highlight

1. **Scenario Textarea** — "Describe the conduct, parties, location, and prior history. Be specific about facts."
2. **Crime Category** — "Pick a category for more accurate framing, or leave as Auto-detect"
3. **Model Tier** — "Fast for quick answers, Thinking High for complex cases requiring deep reasoning"
4. **Context Sliders** — "Adjust severity, intent, and criminal history to refine the analysis"
5. **Language Toggle** — "Get your analysis in English or Amharic"
6. **Submit** — "Press ⌘Enter or click the send button"
7. **Results Preview** — Brief animation or screenshot showing the 7-step output
8. **Trust Badge** — "Retrieves real articles from Proclamation 414/2004. The model abstains rather than invent."

---

## Content Tone

- Professional but approachable
- Authoritative but not arrogant
- Clear and concise (legal professionals value efficiency)
- Warm neutrality — no corporate buzzwords, no excessive enthusiasm
- Example: "HUKM retrieves relevant articles from the Ethiopian Criminal Code and returns a cited seven-step analysis." NOT "Revolutionary AI-powered legaltech disruption!"

---

## Deliverables Needed

1. **Onboarding flow design** — Screens/modals/tooltips for each step
2. **Visual design** — Colors, typography, spacing matching the existing dark theme
3. **Animations/Micro-interactions** — How elements appear, progress, and dismiss
4. **Responsive behavior** — Mobile, tablet, and desktop adaptations
5. **Asset suggestions** — Icons, illustrations, or animated elements needed
6. **Copy/Content** — Exact text for each onboarding step

---

## Existing UI References

### Home Page Layout (Current)
```
┌─────────────────────────────────────────┐
│  [LightRays background effect]          │
│                                         │
│     Legal analysis engine               │
│     Structured analysis of Ethiopian    │
│     criminal law scenarios.             │
│     [Animated subtitle text]            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ [BorderGlow composer card]      │    │
│  │ ┌─────────────────────────────┐ │    │
│  │ │ Describe the scenario...    │ │    │
│  │ │                             │ │    │
│  │ └─────────────────────────────┘ │    │
│  │ [Crime] [Sliders] [Lang] [Model][Send]│
│  └─────────────────────────────────┘    │
│                                         │
│  Try one of these scenarios:            │
│  [Robbery] [Assault] [Property]         │
│                                         │
└─────────────────────────────────────────┘
```

### Navigation
- Sidebar: Analyse, History, Compare, Insights, Resources, Admin
- Mobile: Hamburger menu with same items

---

## Constraints

- No light mode
- No neon/saturated colors outside the defined accent palette
- No generic illustrations (avoid overly cartoonish/legal clichés like scales of justice)
- Must work within the existing layout — onboarding shouldn't permanently take over the screen
- Performance: animations must be 60fps, no layout shift

---

## Inspiration References

- **Perplexity** — Clean dark mode, minimal chrome, focus on content
- **Linear** — Smooth onboarding, subtle animations, professional tone
- **Notion** — Progressive disclosure, contextual tips
- **Claude.ai** — Trust-building through transparency about capabilities

---

**Design the onboarding experience for HUKM. Make it feel like a premium legal research tool that respects the user's intelligence while guiding them to get the most out of the product.**
