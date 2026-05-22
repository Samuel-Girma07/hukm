# Frontend Redesign Prompt: Perplexity Pro Dark Mode For HUKM

## Role
You are a senior frontend engineer and product designer. Redesign the existing HUKM Next.js app so it uses a Perplexity Pro inspired dark interface across every route and component.

## Non-Negotiable Scope
- Frontend only. Do not change API routes, database logic, auth/session ownership, RAG prompts, model IDs, fetch payload shapes, migrations, or server-side business logic.
- Preserve all current routes and user flows: home analysis, results, chat, compare, history, insights, resources, offline, admin login, and admin dashboard.
- Remove light mode entirely. There should be one canonical dark theme, not a light/dark toggle.
- Keep bilingual support and existing translation keys. Do not remove `LanguageProvider`, `LanguageToggle`, or Amharic support.
- Apply the Perplexity-like design to the actual app components listed in this prompt. Do not only update global colors.
- Avoid the current forest/gold/parchment/editorial look. Remove cream backgrounds, forest surfaces, gold CTA styling, Fraunces serif display type, double-bezel ornamentation, and squircle-heavy luxury styling.
- Keep the site professional and legal-domain appropriate, but make placement, spacing, controls, menus, icons, and surface hierarchy feel like Perplexity Pro.

## Source Context To Use
- Existing design doc: `DESIGN.md`.
- Main app files:
  - `app/layout.tsx`
  - `app/globals.css`
  - `tailwind.config.ts`
  - `contexts/ThemeContext.tsx`
  - `components/SiteHeader.tsx`
  - `components/SiteFooter.tsx`
  - `components/Icon.tsx`
  - `components/ScenarioForm.tsx`
  - `components/ModelSelector.tsx`
  - `components/CrimeSelector.tsx`
  - `components/ScenarioSliders.tsx`
  - `components/ChatInterface.tsx`
  - `components/AnalysisView.tsx`
  - `components/CompareView.tsx`
  - `components/HistoryList.tsx`
  - `components/AdminDashboard.tsx`

## Target Visual Direction
Build a dark-first, minimal, AI productivity interface:
- Deep near-black canvas, layered charcoal surfaces, subtle borders, restrained blue/cyan interaction accents.
- Content column centered like Perplexity, with a fixed icon navigation rail and floating contextual controls.
- Large rounded chat/input surfaces with toolbar rows.
- Floating popovers/dropdowns with dark elevated panels and subtle shadows.
- Clean outline icons, quiet labels, high contrast text, and no decorative legal-book aesthetic.
- Typography should feel modern, technical, and calm, not editorial.

## Dark Token System
Replace the current light/dark variable split with one dark-only token set.

Use these core values:
```css
:root {
  color-scheme: dark;

  --bg: 10 10 10;                    /* #0A0A0A canvas */
  --surface: 20 20 20;               /* #141414 base surface */
  --surface-elevated: 28 28 30;      /* #1C1C1E cards/input */
  --surface-overlay: 44 44 46;       /* #2C2C2E popovers/hover */
  --surface-active: 58 58 60;        /* #3A3A3C pressed */

  --text-primary: 255 255 255;       /* #FFFFFF */
  --text-secondary: 235 235 245;     /* #EBEBF5 */
  --text-tertiary: 152 152 157;      /* #98989D */
  --text-muted: 99 99 102;           /* #636366 */
  --text-disabled: 72 72 74;         /* #48484A */

  --accent-blue: 10 132 255;         /* #0A84FF */
  --accent-cyan: 90 200 250;         /* #5AC8FA */
  --accent-green: 48 209 88;         /* #30D158 */
  --accent-amber: 255 159 10;        /* #FF9F0A */
  --accent-red: 255 69 58;           /* #FF453A */

  --border-subtle: 56 56 58;         /* #38383A */
  --border-visible: 72 72 74;        /* #48484A */
  --focus: 10 132 255;               /* #0A84FF */
}
```

Tailwind token aliases should map to these CSS variables:
- `background`: `rgb(var(--bg) / <alpha-value>)`
- `surface`: `rgb(var(--surface-elevated) / <alpha-value>)`
- `surface-container`: `rgb(var(--surface-overlay) / <alpha-value>)`
- `on-surface`: `rgb(var(--text-primary) / <alpha-value>)`
- `on-surface-variant`: `rgb(var(--text-tertiary) / <alpha-value>)`
- `outline`: `rgb(var(--text-muted) / <alpha-value>)`
- `primary`: `rgb(var(--accent-blue) / <alpha-value>)`
- `error`: `rgb(var(--accent-red) / <alpha-value>)`

If legacy color names must remain temporarily for compile safety, remap them to dark gray/blue equivalents. Do not leave visible cream, forest, or gold colors in the UI.

## Typography
- Remove Fraunces and serif display styling from the interface.
- Use a single modern sans stack: `"Plus Jakarta Sans", "Noto Sans Ethiopic", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Preserve `Noto Sans Ethiopic` fallback for Amharic.
- Hero/display: 48-56px desktop, 36-42px tablet/mobile, weight 300-400, line-height 1.12-1.18, letter-spacing -0.02em.
- Page headings: 32-40px, weight 500, line-height 1.2.
- Section headings: 20-24px, weight 600.
- Body: 14-17px, weight 400, line-height 1.55-1.7.
- Labels/captions: 11-13px, weight 500-600, letter-spacing only where it helps scanning.
- Keep tabular numbers for timestamps, counters, confidence stats, chart values, and percentages.

## Global Layout
Redesign `app/layout.tsx` and navigation:
- Replace the current floating pill `SiteHeader` with a Perplexity-like fixed left sidebar on desktop.
- Sidebar desktop width: 64-72px icon rail. Use icon-only controls with tooltips or accessible labels.
- Main content should have left padding/margin to clear the sidebar and a max-width appropriate to each route.
- Add a slim top nav/header area for secondary links or status controls only if needed. It should be dark translucent with `backdrop-blur`, not a cream island.
- Mobile: sidebar becomes a bottom tab bar or slide-out drawer. Use 48px touch targets.
- Remove `ThemeToggle` from all navigation and UI.
- Keep `LanguageToggle`, redesigned as a compact EN/AM control in the lower sidebar or top-right utility area.
- Update viewport `themeColor` to a single dark color `#0A0A0A`.
- Remove the no-flash theme script that reads `hukm-theme`. If a script remains, it should only set `data-theme="dark"`.
- Keep service worker registration, error boundary, shortcuts help, and language provider.

### Desktop Sidebar Items
Use outline icons, 20-22px, stroke 1.5-2px, muted by default and white/blue on active:
- Brand mark: compact HUKM symbol at top. Use a small sparkle/scales/gavel hybrid or a clean `H` monogram. Do not use a serif wordmark.
- New analysis: plus/new thread action linking to `/`.
- Home: `/`
- History: `/history`
- Compare: `/compare`
- Insights: `/insights`
- Resources: `/resources`
- Admin: `/admin` may live near bottom or be hidden behind a utility area.
- Language toggle near bottom.

Active state:
- Background `#1C1C1E`
- Text/icon `#FFFFFF`
- Optional 2px blue/cyan indicator dot or side rail.

## Component System
Create or restyle shared classes in `globals.css`:
- `.card`: `background: #1C1C1E`, `border: 1px solid #38383A`, `border-radius: 14px`, no cream/white surfaces.
- `.card-interactive`: same base plus hover `background: #252527`, border `#48484A`, translateY(-1px).
- `.btn-primary`: white circular/pill CTA for primary input-send actions, or blue accent for larger page CTAs. Match Perplexity: high contrast, minimal chrome.
- `.btn-secondary`: `#1C1C1E` surface, subtle border, text `#EBEBF5`.
- `.btn-ghost`: transparent with muted text, hover `#2C2C2E`.
- `.input`, `.textarea`, `.select`: dark elevated surface, subtle border, focus ring blue, placeholder `#636366`.
- `.chip`/`.pill`: dark compact tokens with gray border and muted text; selected chips use blue/cyan tint.
- Replace `.bezel-shell`, `.bezel-core`, `.bezel-shell-sm`, `.bezel-core-sm`, `.island-*`, `.eyebrow`, and squircle classes with simpler Perplexity-like tokens. Keep aliases only if needed for staged refactor, but visually they must render as dark rounded cards, not double bezels.

## Icons
Current app uses `components/Icon.tsx` with Phosphor icons and Material-symbol-compatible names. Keep that API if it avoids churn, but redesign the output:
- Use consistent outline style (`light` or `regular`) for all default icons.
- Use filled icons only for selected, success, or status badges.
- Add missing mappings for `thumb_up` and `thumb_down` used by `FeedbackWidget`.
- Audit all icon names and ensure no placeholder dashed square appears in normal UI.
- Icon visual language should match Perplexity/Lucide: thin strokes, geometric, monochrome unless semantically required.

Required mapped icons:
- Navigation: home, history/schedule, compare_arrows, analytics/bar_chart, auto_stories/resources, account/admin, plus/new, settings if added.
- Core actions: send, search, close, delete, refresh, share, picture_as_pdf, arrow_forward, arrow_back, expand_more, chevron_right, unfold_more.
- Legal/status: gavel, balance, route, flag, verified, warning, error/report, info, psychology, check/check_circle.
- Communication/resources: call, mail, support_agent, visibility, forum.
- Language/theme cleanup: translate remains; light_mode/dark_mode can be removed if unused.

## Route And Component Redesigns

### Home Page: `app/page.tsx`
Turn the current editorial split into a centered Perplexity-like prompt screen:
- Center a hero title above the form, similar to "perplexity pro". Use HUKM/translations, not generic marketing copy.
- Max content width: 760-820px.
- Remove the two-column editorial layout, Fraunces headline, cream form bezel, and left marketing-heavy body layout.
- `ScenarioForm` should be the primary object on the page: large rounded dark input card with toolbar, controls, examples, and disclaimer.
- Suggestion/example prompts should become a Perplexity-like quick-action grid below the input: 2-3 columns desktop, 1 column mobile, icon + label.

### Scenario Form: `components/ScenarioForm.tsx`
Redesign from a form stack into an AI composer:
- Outer container: `#1C1C1E`, 1px `#38383A`, 18-20px radius, 16-20px padding.
- Textarea: borderless, transparent, min-height 140-180px, placeholder muted, no separate label above unless visually hidden.
- Header/placeholder copy should guide the user naturally, similar to "Describe the legal scenario...".
- Footer toolbar inside the same input card:
  - Left: add/focus icon if useful, CrimeSelector as `Focus` dropdown, LanguageToggle compact pill.
  - Middle/right: ModelSelector trigger ("Model name"), optional advanced options trigger.
  - Far right: circular send button with `send` or `gavel` icon. Disabled state muted gray.
- Move `ScenarioSliders` into an "Advanced" popover or collapsible dark mini panel anchored to the toolbar. Do not show a large card by default.
- Validation errors should be inline below the composer, dark red surface, not browser-like.
- `AnalysisProgress` should appear as a compact dark status card below the composer while streaming.
- Examples become suggestion cards below, not pills packed inside the form.
- Disclaimer remains, but style it as small centered muted text below the composer, not serif italic.

### Model Selector: `components/ModelSelector.tsx`
Make it match Perplexity's model dropdown:
- Trigger: compact inline button inside the composer footer or compare toolbar. Transparent/subtle surface, 14px text, chevron.
- Popover: `width: 340-380px`, background `#1C1C1E`, border `#38383A`, radius 14px, shadow `0 8px 32px rgba(0,0,0,.5)`, padding 8px.
- Items: icon/logo left, label + tagline, optional badge, selected checkmark right.
- Add a top "Best" item if appropriate; it can map to the current default model without changing backend model IDs.
- Premium/tier badges should be compact dark gray or blue-tinted, not gold.
- Keep keyboard support: Enter/Space, ArrowUp/Down, Home/End, Esc, outside click.
- `NvidiaLogo`/powered-by line should become a small muted caption or be removed if visually noisy. Do not use green/gold styling.

### Crime Selector: `components/CrimeSelector.tsx`
- Restyle as a "Focus" dropdown in the composer toolbar.
- Use an icon and selected label, not a full-width form field on the home screen.
- In contexts where it remains full-width, use dark select styling with a subtle border and chevron.
- Do not change category values or payload names.

### Scenario Sliders: `components/ScenarioSliders.tsx`
- Replace the visible large `details.card` with a compact "Advanced" popover.
- Use three horizontal controls for severity, intent, and history with muted labels and blue/cyan accent range tracks.
- Badge current values with dark chips.
- Keep the same state shape `{ severity, intent, history }`.

### Language Toggle: `components/LanguageToggle.tsx`
- Keep functionality.
- Compact mode: dark pill with translate icon and EN/AM label; active/hover uses `#2C2C2E`.
- Labelled mode: segmented control with dark track and blue active segment, no gold/forest.

### Results Page And Analysis View: `components/AnalysisView.tsx`
Redesign results as a polished dark analysis workspace:
- Header: compact eyebrow/chip, large sans heading, action buttons grouped on right.
- Actions: PDF, share, continue in chat, compare, new analysis. Use dark secondary buttons and one clear primary action.
- Scenario summary: dark elevated card with model label and timestamp-like metadata styling.
- ConfidenceExplainer: compact dark panel with confidence badge, reason, and stat grid.
- Seven analysis steps: keep timeline, but simplify medallions and cards. Use dark cards, blue/cyan conclusion highlight, muted vertical rule.
- Punishment and procedural roadmap: asymmetric bento cards with outline legal icons in small dark icon squares.
- Sources: dense row list like a search result list; hover highlights; similarity chips with blue/green/amber/red tones.
- Suggested follow-ups: Perplexity-style prompt chips/cards under results.
- Disclaimer: muted dark note card, no serif italic.
- FeedbackWidget and LawyerCards should visually belong to the same dark system.

### Chat: `components/ChatInterface.tsx` and `components/MessageBubble.tsx`
Make the chat route feel like the Perplexity interface:
- Layout: centered messages column, floating composer fixed/absolute at bottom, optional context side panel as a dark card.
- Context pane: can be right side or collapsible left panel, but must use dark surfaces and compact metadata.
- Messages:
  - User bubble: dark active/accent bubble, right aligned, not gold.
  - Assistant bubble: transparent or dark card, left aligned, readable text, sources expandable.
  - Thinking bubble: three subtle animated dots, muted caption.
- Composer:
  - Same visual language as ScenarioForm input: dark rounded card, toolbar row, circular send button.
  - Gradient fade above composer should use the dark canvas tokens.
- Mobile context button should be a compact dark pill, not island/gold.

### History: `components/HistoryList.tsx`
- Header: dark page title with muted subtitle.
- Search/filter bar: Perplexity-like floating dark rounded bar with search icon and segmented filter chips.
- List rows: dark elevated cards with title, updated time, model, message count, confidence badge, and delete icon.
- Empty states: dark centered card with quiet icon and CTA.
- Delete uses `ConfirmDialog` restyled to dark modal.

### Compare: `components/CompareView.tsx`
- Keep side-by-side comparison workflow and query params.
- Header centered with short explanation.
- Model selector as a compact dark dropdown.
- Scenario A/B editors: dark input cards with badge letters, counters, and no cream bezel.
- Results: accordions in dark cards, confidence badges, punishment card with a left accent rail using semantic colors.
- Export comparison button: secondary dark button with PDF icon.

### Insights: `app/insights/page.tsx`
- Redesign the heatmap table as a dark data surface.
- Header controls: dark refresh icon button.
- Table header: `#141414` or `#1C1C1E`, muted uppercase labels.
- Rows: hover `#252527`, subtle dividers.
- Bars: use blue/cyan accent, not gold.
- Empty/error/loading states use shared components.

### Resources: `app/resources/page.tsx` and `components/LawyerCard.tsx`
- Filter strip: horizontal dark chips, active blue/cyan tint.
- Lawyer/resource cards: dark elevated cards, type badge, free-service badge green, language chip, contact icons.
- Contact buttons: 40px circular dark icon buttons with hover state.
- Bottom callout: dark rounded card with subtle blue ambient gradient, not gold.

### Admin Login: `app/admin/login/page.tsx`
- Dark centered login card.
- Password input: dark field, blue focus ring.
- Submit: simple dark/white or blue primary button.
- Error state: dark red inline panel.

### Admin Dashboard: `components/AdminDashboard.tsx`
- Convert charts and cards to dark dashboard styling.
- KPI cards: dark elevated surfaces, muted labels, tabular big values.
- Recharts:
  - Grid: `rgba(255,255,255,0.08)`
  - Axis text: `#98989D`
  - Tooltip background: `#1C1C1E`, border `#38383A`, text `#EBEBF5`
  - Main lines/bars: blue/cyan; success green; warnings amber; errors red.
- Recent feedback and heatmap list rows: dark cards with subtle dividers.
- Refresh/sign-out controls use shared button styles.

### Article Panel: `components/ArticlePanel.tsx`
- Keep slide-over behavior, Esc close, body scroll lock.
- Overlay: `rgba(0,0,0,0.65)` with blur.
- Panel: right-side dark drawer `#141414` or `#1C1C1E`, border-left `#38383A`, 480px desktop/full mobile.
- Sticky header dark translucent with close icon button.
- Related articles use redesigned LawChunkCard rows.

### Sources And Law Chunks: `components/SourcesPanel.tsx`, `components/LawChunkCard.tsx`
- Empty state: dashed dark panel with muted text.
- Details panel: dark card, compact summary row, count chip.
- Source rows: icon square, article ref, document chip, one-line content preview, similarity chip, chevron.
- Similarity colors:
  - Strong: blue or green tint
  - Moderate: cyan/amber tint
  - Weak: amber/red tint

### Shared States
Redesign these components to match the new dark system:
- `EmptyState.tsx`: dark elevated centered card, 56-64px muted icon medallion, primary CTA.
- `ErrorState.tsx`: dark red panel, warning icon, direct copy, optional retry button.
- `ConfirmDialog.tsx`: dark modal card, blurred overlay, safe cancel focus, destructive red confirm.
- `Toast.tsx`: bottom-center dark pill/card with subtle border and blur.
- `LoadingSkeleton.tsx`: skeletons in `rgba(255,255,255,0.08)` with shape matching real cards.
- `Spinner.tsx`: use current spinner if acceptable, recolored to `currentColor`/blue.
- `ShortcutsHelp.tsx`, `InfoHint.tsx`, `Kbd.tsx`, `CacheHitBadge.tsx`, `AnalysisPDFLink.tsx`: restyle all small utility UI to dark surfaces, muted borders, blue accents.

### Error, Not Found, Offline, Loading Pages
- `app/error.tsx`, `app/not-found.tsx`, `app/offline/page.tsx`, `app/loading.tsx` must be dark-only.
- Use the same page container and shared states.
- Replace raw arrow characters in CTA icon areas with the shared `Icon`.

## Footer
`SiteFooter` should be quiet and dark:
- Remove cream pill styling.
- Either place it in the main content flow or hide it on full-screen chat-like pages if it competes with the composer.
- Use small muted text and one resources link. No serif italic.

## Motion And Interaction
- Hover transitions: 120-200ms.
- Dropdown entry: opacity + translateY(-6px) + scale(0.98) to final over 180-220ms.
- Buttons: active scale 0.97-0.98.
- Cards: optional translateY(-1px) hover, not dramatic.
- All animation should use transform/opacity, not layout properties.
- Keep `prefers-reduced-motion` support.
- Keep visible focus rings: 2px blue outline, 2px offset.

## Responsive Rules
- Desktop: fixed 64-72px sidebar, centered main content.
- Tablet: sidebar may stay icon rail, content padding reduces.
- Mobile:
  - Navigation becomes bottom tab bar or slide-out drawer.
  - Home composer full width with 16px edge padding.
  - Suggestion cards stack to 1 column.
  - Model selector and advanced controls become bottom sheets or full-width popovers.
  - Chat context pane collapses.
  - Touch targets minimum 44px.

## Backend Safety Checklist
Do not change:
- Any file under `app/api` unless purely type/import cleanup is absolutely necessary.
- Supabase table names, RPC calls, query filters, or ownership checks.
- `lib/prompts.ts`, parser schemas, RAG retrieval, embeddings, cache logic, or streaming protocol.
- Request body keys for `/api/analyze`, `/api/chat`, `/api/conversations`, `/api/share`, `/api/feedback`, admin APIs.
- Route paths or query parameter names.

Allowed changes:
- React component JSX/classes.
- Component composition and client-side layout.
- Tailwind config tokens.
- Global CSS variables/utilities.
- Icon mapping and visual weights.
- Fonts loaded in `app/layout.tsx`.
- Theme context removal/hardcoding as long as callers still compile.

## Implementation Order
1. Replace global tokens in `globals.css` and Tailwind mappings in `tailwind.config.ts`.
2. Remove light mode plumbing: `ThemeToggle`, `ThemeContext` toggle behavior, `data-theme` light support, `dark:` dependency.
3. Build the new sidebar navigation and update `app/layout.tsx` spacing.
4. Redesign shared primitives: cards, inputs, buttons, chips, popovers, dialogs, toast, empty/error/loading states.
5. Redesign `ScenarioForm`, `ModelSelector`, `CrimeSelector`, and `ScenarioSliders`.
6. Redesign home page and suggestions.
7. Redesign results/analysis, sources, article panel, feedback, and lawyer/resource cards.
8. Redesign chat and composer.
9. Redesign history, compare, insights, resources, admin login, and admin dashboard.
10. Audit icons and all remaining cream/forest/gold/serif/dark-mode-toggle references.

## Acceptance Criteria
- There is no visible light mode and no UI route renders cream, white-card, forest, or gold surfaces.
- No theme toggle is visible anywhere.
- `data-theme` is always dark or no longer required.
- All routes compile and remain functionally equivalent.
- Every interactive component has hover, active, disabled, and focus-visible states.
- All normal icons render correctly with no placeholder dashed icons.
- The home page and chat composer strongly resemble Perplexity's dark input/composer design.
- Model dropdown, source rows, suggestions, and navigation feel like a Perplexity Pro dark interface.
- Admin charts use dark tooltip/grid/axis colors.
- Mobile layouts remain usable with 44px minimum touch targets.
- Run `npm run typecheck` and `npm run lint` after changes. If either command cannot run, document the reason.

## Final QA Search Terms
After implementation, search the codebase for these and remove or remap visible styling:
- `ThemeToggle`
- `toggleTheme`
- `light_mode`
- `dark_mode`
- `Fraunces`
- `font-display` if still mapped to serif
- `cream-`
- `forest-`
- `brand-300`, `brand-400`, `gold`
- `bg-white`
- `text-forest`
- `dark:`
- `bezel-shell`
- `bezel-core`
- `island-primary`
- `island-secondary`
- `italic-serif`

If aliases remain for compatibility, they must render dark Perplexity-like styles and must not preserve the old visual design.
