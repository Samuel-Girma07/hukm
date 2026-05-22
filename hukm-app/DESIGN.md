# Design System Inspired by Perplexity

## 1. Visual Theme & Atmosphere

Perplexity's design system embodies a clean, modern, and intellectually sophisticated aesthetic rooted in minimalism and clarity. The palette favors warm neutrals with subtle earth tones, creating a grounded yet forward-thinking atmosphere. The interface prioritizes whitespace and restrained color usage, allowing content and functionality to take center stage. Deep charcoal and warm brown accents provide gentle visual hierarchy without overwhelming the user. Icons and navigation elements are intentionally understated, fostering a calm, focused environment ideal for complex information discovery and AI-powered assistance.

**Key Characteristics**
- Minimalist approach with generous whitespace
- Warm neutral palette grounded in earth tones
- Subtle, controlled use of accent colors for emphasis
- High contrast between text and background for readability
- Rounded elements for approachability and softness
- Icon-driven interface supporting visual scanning
- Responsive layout that scales gracefully across devices
- Consistent microcopy and interaction patterns

## 2. Color Palette & Roles

### Primary
- **Deep Brown** (`#271A00`): Primary text, headings, and core UI elements; establishes dominant visual weight across the interface
- **Near Black** (`#000000`): High-contrast body text, borders, and critical interactive elements; used for maximum legibility

### Accent Colors
- **Warm Tan** (`#27251E`): Secondary text, subtle UI backgrounds, and muted interactive states; provides warm contrast to cool neutrals
- **Rust Red** (`#A23544`): Accent color for tertiary interactions and decorative elements
- **Rose** (`#DC6973`): Soft accent for hover states and highlighted content regions
- **Burnt Orange** (`#97431A`): Warm accent for secondary CTAs and contextual highlights
- **Terracotta** (`#D57141`): Accent for featured sections and secondary visual emphasis

### Interactive
- **Primary CTA** (`#000000`): Buttons and main calls-to-action with maximum visibility and engagement
- **Secondary Interactive** (`#27251E`): Muted buttons, ghost states, and lower-priority actions
- **Hover Overlay** (`rgba(39, 37, 30, 0.65)`): Semi-transparent overlay for button hover states and interactive feedback

### Neutral Scale
- **Off-White** (`#FDFBFA`): Soft background for content containers and card surfaces
- **White** (`#FFFFFF`): Primary background for main content areas and light surfaces
- **Light Gray** (`#D6D5D4`): Dividers, subtle borders, and disabled state backgrounds
- **Transparent Black** (`#0000`): Transparent overlays and layered depth effects
- **Transparent White** (`#FFF0`): Semi-transparent white for frosted glass effects

### Surface & Borders
- **Subtle Border** (`rgba(39, 26, 0, 0.14)`): Delicate borders for input fields, cards, and container edges
- **Very Light Background** (`rgba(39, 26, 0, 0.035)`): Navigation and sidebar backgrounds; barely perceptible surface distinction
- **Light Border Variant** (`rgba(39, 26, 0, 0.07)`): Secondary borders and dividers for component separation

### Semantic / Status
- **Success** (`#539E55`): Positive feedback, completion states, and affirmative actions
- **Error** (`#E10600`): Error messages, warnings, and destructive actions

## 3. Typography Rules

### Font Family
**Primary Font:** pplxSans (custom sans-serif family)
**Fallback Stack:** `pplxSans, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif`

**Secondary Font:** Same as primary for consistency; no secondary typeface in system.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display / H1 | pplxSans | 32px | 400 | 40px | 0px | Hero titles and brand statements |
| Heading / H2 | pplxSans | 16px | 400 | 24px | 0px | Section headers and component titles |
| Subheading / H3 | pplxSans | 14px | 400 | 20px | 0px | Secondary headings and navigation labels |
| Body / Text | pplxSans | 16px | 400 | 24px | 0px | Primary reading text and paragraphs |
| Body Small | pplxSans | 14px | 400 | 20px | 0px | Secondary body text and descriptions |
| Button | pplxSans | 16px | 400 | 24px | 0px | Interactive button labels |
| Caption | pplxSans | 12px | 400 | 16px | 0px | Captions, helper text, and metadata |
| Code | pplxSans | 13px | 400 | 18px | 0px | Inline code and preformatted text |

### Principles
- **Weight Consistency:** Single weight (400) across all roles for refined uniformity
- **Line Height Ratio:** 1.5x multiplier on size maintains vertical rhythm and breathing room
- **Size Progression:** 12px → 14px → 16px → 32px follows a clean scale
- **Legibility First:** Generous line height and size prevent cramping and improve scanning
- **Minimal Hierarchy:** Restraint in weight variation relies on size and color shifts for distinction
- **Accessibility:** Base font size of 16px on body ensures WCAG AA compliance without scaling

## 4. Component Stylings

### Buttons

**Primary Button**
- Background: `#000000`
- Text Color: `#FFFFFF`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `12px 24px`
- Border Radius: `6px`
- Border: `0px solid transparent`
- Box Shadow: `none`
- Height: `40px`
- Line Height: `24px`
- Hover State: Background `rgba(39, 37, 30, 0.9)`, text `#FFFFFF`
- Active State: Background `#1A1A1A`, text `#FFFFFF`
- Disabled State: Background `#D6D5D4`, text `rgba(39, 37, 30, 0.5)`, cursor `not-allowed`

**Secondary Button**
- Background: `rgba(39, 26, 0, 0.07)`
- Text Color: `rgba(39, 37, 30, 0.65)`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `12px 24px`
- Border Radius: `6px`
- Border: `1px solid rgba(39, 26, 0, 0.14)`
- Box Shadow: `none`
- Height: `40px`
- Line Height: `24px`
- Hover State: Background `rgba(39, 26, 0, 0.12)`, text `rgba(39, 37, 30, 0.8)`
- Active State: Background `rgba(39, 26, 0, 0.18)`, text `#27251E`
- Disabled State: Background `#D6D5D4`, text `rgba(39, 37, 30, 0.5)`, cursor `not-allowed`

**Ghost Button (Icon)**
- Background: `rgba(0, 0, 0, 0)`
- Text Color: `rgba(39, 37, 30, 0.65)`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `8px 8px`
- Border Radius: `12px`
- Border: `0px solid transparent`
- Box Shadow: `none`
- Height: `40px`
- Width: `40px`
- Line Height: `24px`
- Hover State: Background `rgba(39, 26, 0, 0.08)`, text `rgba(39, 37, 30, 0.8)`
- Active State: Background `rgba(39, 26, 0, 0.15)`, text `#27251E`

**Small Icon Button**
- Background: `rgba(0, 0, 0, 0)`
- Text Color: `rgba(39, 37, 30, 0.65)`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `0px`
- Border Radius: `6px`
- Border: `0px solid transparent`
- Box Shadow: `none`
- Height: `24px`
- Width: `24px`
- Line Height: `24px`
- Hover State: Background `rgba(39, 26, 0, 0.08)`, text `rgba(39, 37, 30, 0.8)`

### Cards & Containers

**Standard Card**
- Background: `#FFFFFF`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `16px 16px`
- Border Radius: `12px`
- Border: `1px solid rgba(39, 26, 0, 0.14)`
- Box Shadow: `rgba(0, 0, 0, 0.08) 0px 1px 2px 0px`
- Line Height: `24px`
- Hover State: Border `rgba(39, 26, 0, 0.25)`, box-shadow `rgba(0, 0, 0, 0.12) 0px 2px 4px 0px`

**Elevated Card**
- Background: `#FDFBFA`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `16px 16px`
- Border Radius: `12px`
- Border: `1px solid rgba(39, 26, 0, 0.07)`
- Box Shadow: `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
- Line Height: `24px`

**Prompt Card**
- Background: `#FFFFFF`
- Text Color: `#000000`
- Font Size: `14px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `12px 16px`
- Border Radius: `12px`
- Border: `1px solid rgba(39, 26, 0, 0.14)`
- Box Shadow: `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
- Line Height: `20px`
- Hover State: Background `#FDFBFA`, cursor `pointer`

### Inputs & Forms

**Text Input (Default)**
- Background: `#FFFFFF`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `12px 16px`
- Border Radius: `12px`
- Border: `1px solid rgba(39, 26, 0, 0.14)`
- Box Shadow: `none`
- Height: `48px`
- Line Height: `24px`
- Placeholder Color: `rgba(39, 37, 30, 0.5)`
- Focus State: Border `rgba(39, 26, 0, 0.3)`, box-shadow `rgba(0, 0, 0, 0.08) 0px 1px 2px 0px`, outline `none`

**Text Input (Error)**
- Background: `#FFFFFF`
- Text Color: `#E10600`
- Border: `1px solid #E10600`
- Box Shadow: `rgba(225, 6, 0, 0.1) 0px 1px 3px 0px`

**Text Input (Success)**
- Background: `#FFFFFF`
- Text Color: `#000000`
- Border: `1px solid #539E55`
- Box Shadow: `rgba(83, 158, 85, 0.1) 0px 1px 3px 0px`

**Search Input**
- Background: `#FFFFFF`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `12px 16px`
- Border Radius: `12px`
- Border: `1px solid rgba(39, 26, 0, 0.14)`
- Box Shadow: `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
- Height: `48px`
- Line Height: `24px`
- Focus State: Border `rgba(39, 26, 0, 0.3)`, background `#FDFBFA`

### Navigation

**Sidebar Navigation**
- Background: `rgba(39, 26, 0, 0.035)`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `0px`
- Border Radius: `0px`
- Border: `1px solid rgba(39, 26, 0, 0.07)`
- Box Shadow: `none`
- Height: `900px`
- Width: `200px`
- Line Height: `24px`
- Item Padding: `12px 16px`
- Item Hover: Background `rgba(39, 26, 0, 0.08)`
- Item Active: Background `rgba(39, 26, 0, 0.15)`, color `#000000`, font-weight `500`

**Navigation Link**
- Background: `rgba(0, 0, 0, 0)`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `8px 16px`
- Border Radius: `12px`
- Border: `0px solid transparent`
- Box Shadow: `none`
- Height: `40px`
- Line Height: `24px`
- Hover State: Background `rgba(39, 26, 0, 0.08)`, text-decoration `none`
- Active State: Background `rgba(39, 26, 0, 0.15)`, font-weight `500`

**Top Navigation Bar**
- Background: `#FFFFFF`
- Text Color: `#000000`
- Font Size: `16px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `0px 24px`
- Border Radius: `0px`
- Border: `0px solid transparent`
- Box Shadow: `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
- Height: `64px`
- Line Height: `24px`
- Item Spacing: `24px` between navigation items

### Badges & Labels

**Badge (Default)**
- Background: `rgba(39, 26, 0, 0.08)`
- Text Color: `#27251E`
- Font Size: `12px`
- Font Weight: `400`
- Font Family: `pplxSans`
- Padding: `4px 12px`
- Border Radius: `9999px`
- Border: `0px solid transparent`
- Box Shadow: `none`
- Height: `24px`
- Line Height: `16px`

**Badge (Success)**
- Background: `rgba(83, 158, 85, 0.1)`
- Text Color: `#539E55`
- Padding: `4px 12px`
- Border Radius: `9999px`

**Badge (Error)**
- Background: `rgba(225, 6, 0, 0.1)`
- Text Color: `#E10600`
- Padding: `4px 12px`
- Border Radius: `9999px`

## 5. Layout Principles

### Spacing System

**Base Unit:** `8px`

**Spacing Scale:**
- `4px`: Extra-tight spacing for badge padding and micro-interactions
- `8px`: Button padding and tight component margins
- `12px`: Card and input padding; moderate component spacing
- `16px`: Standard padding for containers and sections
- `24px`: Large margins between content sections
- `32px`: Extra-large spacing between major layout sections
- `92px`: Hero section and maximum-width container padding

**Usage Context:**
- Buttons and small controls: `8px` to `12px`
- Cards and contained content: `16px` internal padding
- Section separation: `24px` to `32px` margins
- Sidebar navigation items: `12px` padding
- Page margins: `24px` to `92px` depending on screen size

### Grid & Container

**Max Width:** `1200px` for primary content container; `100vw` for full-bleed sections

**Column Strategy:** 
- Desktop: 12-column grid with `24px` gutters
- Tablet: 8-column grid with `16px` gutters
- Mobile: 4-column grid with `16px` gutters

**Layout Sections:**
- Sidebar: `200px` fixed width on desktop; collapsible below `768px`
- Content Area: Fills remaining width with `16px` margins
- Maximum text line length: `800px` for readability

### Whitespace Philosophy

Perplexity prioritizes generous whitespace to reduce cognitive load and emphasize content clarity. Layouts employ breathing room between sections, creating visual rhythm and hierarchy. Card surfaces float on neutral backgrounds, and padding within components is uniform and predictable. This approach supports scannability and allows UI elements to communicate through negative space rather than visual noise.

### Border Radius Scale

- `4px`: Small icon buttons and minor UI elements; subtle, minimal rounding
- `6px`: Secondary buttons and small containers; controlled curvature
- `9999px`: Badges and fully rounded elements; pill-shaped interactive components
- `12px`: Primary cards, inputs, and major components; balanced, modern appearance
- `0px`: Top navigation bar and full-width section dividers; straight edges for structural elements

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (0) | No shadow | Navigation bars, section dividers, background surfaces |
| Subtle (1) | `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` | Elevated cards, input fields, secondary containers |
| Raised (2) | `rgba(0, 0, 0, 0.08) 0px 1px 2px 0px` | Primary cards, hover states on interactive elements |
| Prominent (3) | `rgba(0, 0, 0, 0.12) 0px 2px 4px 0px` | Modals, popovers, floating action menus |
| Maximum (4) | `rgba(0, 0, 0, 0.15) 0px 4px 8px 0px` | Dropdown menus, notifications, overlay dialogs |

**Shadow Philosophy**

Perplexity employs a restrained shadow system that prioritizes subtlety over drama. Shadows are designed to hint at depth without dominating the visual experience. Multiple box-shadow layers (color, size, blur, spread) work together to create a soft, natural appearance reminiscent of soft lighting. The system avoids harsh black shadows; instead, it uses semi-transparent black (`rgba(0, 0, 0, 0.05-0.15)`) to maintain warmth and softness. This approach supports the minimalist aesthetic while communicating hierarchy through elevation rather than visual contrast.

## 7. Do's and Don'ts

### Do

- Use consistent `16px` base font size for body text to ensure readability and WCAG compliance
- Apply `12px` border radius to all primary interactive components (cards, inputs, buttons) for visual consistency
- Employ `rgba(39, 26, 0, 0.14)` borders for subtle container separation; avoid heavy black outlines
- Stack components with `16px` to `24px` vertical spacing to create clear visual rhythm
- Use `#000000` text on light backgrounds for maximum contrast and legibility
- Maintain a single-weight typography system (`400`) and differentiate hierarchy through size progression
- Apply hover states to all interactive elements using background opacity shifts (`+0.05` to `+0.08`)
- Use the warm neutral palette (`#27251E`, `#97431A`, `#D57141`) for secondary accents and context
- Leverage the `#539E55` success color only for positive confirmations and completion states
- Reserve the `#E10600` error color exclusively for destructive actions and error messaging
- Implement generous padding (`12px` to `16px`) inside cards and inputs to prevent visual cramping
- Use icon-first navigation patterns with optional text labels for responsive adaptability

### Don't

- Do not mix font families; pplxSans must remain the sole typeface across all UI layers
- Do not use font weights other than `400` for primary interface text; avoid heavy or light variants
- Do not apply shadows exceeding `rgba(0, 0, 0, 0.15)` to avoid harsh visual effects that contradict the minimalist aesthetic
- Do not use border radius smaller than `4px` on interactive elements; maintain design consistency
- Do not apply bright, saturated accent colors beyond the defined palette; avoid neon or high-contrast additions
- Do not place text smaller than `12px` for captions; `10px` or below compromises readability
- Do not use more than two color variations in a single interactive component; maintain visual simplicity
- Do not nest spacing values outside the established `8px` base unit scale (e.g., avoid `18px` or `13px`)
- Do not apply multiple shadows to a single element; use a single, contextually appropriate shadow level
- Do not create transparent overlays exceeding `0.4` opacity; preserve content visibility beneath modals
- Do not remove focus states or outlines on interactive elements; maintain keyboard accessibility
- Do not apply rounding to input field borders exceeding `12px`; prevents proper internal padding visibility
- Do not use the rust or terracotta accent colors for primary actions; reserve them for tertiary elements only

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Key Changes |
|------------|-------|-------------|
| Mobile | `0px` to `639px` | Sidebar hides (hamburger menu), single-column layout, `16px` margins, touch targets `48px` min |
| Tablet | `640px` to `1023px` | Sidebar remains visible but reduced width (`160px`), 8-column grid, `24px` margins, component padding `12px` |
| Desktop | `1024px` and above | Full sidebar (`200px`), 12-column grid, `24px` to `92px` margins, component padding `16px` |
| Large Desktop | `1440px` and above | Max-width container constraints, centered layout, larger typography spacing |

### Touch Targets

- Minimum touch target size: `48px` × `48px` for mobile and tablet interfaces
- Button height standard: `40px` at desktop, `48px` at tablet/mobile
- Icon buttons: `40px` × `40px` desktop, `48px` × `48px` touch devices
- Navigation item height: `40px` at all breakpoints
- Spacing between touch targets: Minimum `8px` on mobile, `12px` on tablet

### Collapsing Strategy

**Navigation Sidebar:**
- Desktop: `200px` fixed, inline with content
- Tablet: `160px` fixed, navigation remains visible
- Mobile: Hidden by default; triggered via hamburger menu toggle; full-screen overlay or drawer
- Collapsed state background: Same as expanded (`rgba(39, 26, 0, 0.035)`)

**Content Container:**
- Desktop: Max-width `1200px`, centered with `92px` side margins
- Tablet: Full width with `24px` margins
- Mobile: Full width with `16px` margins

**Grid Layout:**
- Desktop: 12-column with `24px` gutters
- Tablet: 8-column with `16px` gutters
- Mobile: Single-column or 4-column with `16px` gutters; cards stack vertically

**Text & Typography:**
- Desktop: Full `16px` to `32px` hierarchy maintained
- Tablet: Reduce H1 from `32px` to `24px`; H2 remains `16px`
- Mobile: Reduce H1 to `20px`; H2 to `14px`; maintain `16px` body text

**Button & Input Padding:**
- Desktop: `12px 24px` for buttons, `12px 16px` for inputs
- Tablet: `12px 20px` for buttons, `12px 14px` for inputs
- Mobile: `12px 16px` for buttons, `12px 12px` for inputs; full-width forms

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA:** Deep Black (`#000000`)
- **Secondary CTA:** Warm Tan (`#27251E`)
- **Background (Main):** White (`#FFFFFF`)
- **Background (Alt):** Soft Off-White (`#FDFBFA`)
- **Heading Text:** Deep Brown (`#271A00`)
- **Body Text:** Deep Brown (`#271A00`) or Near Black (`#000000`)
- **Muted Text:** Semi-transparent Brown (`rgba(39, 37, 30, 0.65)`)
- **Borders:** Light Brown (`rgba(39, 26, 0, 0.14)`)
- **Success Accent:** Green (`#539E55`)
- **Error Accent:** Red (`#E10600`)
- **Sidebar Background:** Very Light Brown (`rgba(39, 26, 0, 0.035)`)

### Iteration Guide

1. **Font & Typography:** All text must use `pplxSans` at `400` weight; vary hierarchy exclusively through size (`12px`, `14px`, `16px`, `32px`) and color opacity shifts.

2. **Spacing & Padding:** Use multiples of `8px` (4px, 8px, 12px, 16px, 24px, 32px, 92px); standard button padding is `12px 24px`, card padding is `16px 16px`, input padding is `12px 16px`.

3. **Border Radius:** Apply `6px` to secondary buttons and small elements, `12px` to primary cards/inputs/navigation links, `9999px` to badges and fully rounded pills, `4px` to small icon buttons.

4. **Shadows:** Use subtle shadows only (`rgba(0, 0, 0, 0.05-0.12)`); standard card shadow is `rgba(0, 0, 0, 0.08) 0px 1px 2px 0px`; avoid harsh or dark shadows.

5. **Colors & Contrast:** Primary text is always `#000000` or `#271A00`; use `rgba(39, 37, 30, 0.65)` for muted/secondary text; maintain minimum `rgba(39, 26, 0, 0.14)` for borders.

6. **Interactive States:** All buttons and clickable elements must include hover (background opacity `+0.05`), active (opacity `+0.08`), and disabled (opacity `0.5`, cursor `not-allowed`) states.

7. **Responsive Behavior:** Hide sidebar on mobile (`< 640px`), show hamburger menu; reduce heading sizes on mobile (`H1: 20px`, `H2: 14px`); maintain `48px` minimum touch targets.

8. **Accessibility:** Ensure keyboard focus visible on all interactive elements; minimum font size `12px` for captions; line-height minimum `1.5x` of font size; contrast ratio WCAG AA compliant.

9. **Consistency:** Never introduce new colors, fonts, or spacing values outside the documented system; when in doubt, default to neutrals and the warm accent palette.