# Requirements Document

## Introduction

This document specifies the requirements for redesigning the HUKM application user interface from its current Ethiopian heritage theme to a Perplexity Pro-inspired dark aesthetic. The redesign preserves the application's gold accent color as the primary interactive element while adopting Perplexity's dark backgrounds, UI patterns, and visual hierarchy. The scope encompasses all frontend components and styling across 8 pages, excluding administrative interfaces. No backend functionality will be modified.

## Glossary

- **UI_System**: The complete frontend user interface of the HUKM application, including all React components, Tailwind CSS styles, and visual design elements
- **Theme_Toggle**: The existing React component (ThemeToggle.tsx) that allows users to switch between light and dark color schemes
- **Light_Mode**: The current parchment-colored theme variant with cream backgrounds and forest green text
- **Dark_Mode**: The current forest green theme variant with deep green backgrounds and gold accents
- **Perplexity_Aesthetic**: The visual design language of Perplexity Pro, characterized by deep dark backgrounds (#0A0A0A to #1A1A1A range), subtle gray surfaces, minimal borders, and high contrast text
- **Gold_Accent**: The heritage gold color (#D4A24C in dark mode, #8A6A20 in light mode) used for interactive elements, currently preserved as the primary brand color
- **Component**: A reusable React component file in the /components directory
- **Page**: A Next.js route component in the /app directory
- **Global_Styles**: The globals.css file containing Tailwind CSS configuration, CSS custom properties, and component classes
- **Color_Token**: A CSS custom property (--variable-name) defining a semantic color value in the design system
- **Surface**: A background layer for cards, panels, and elevated UI elements
- **AI_Prompt**: A detailed markdown document (prompt.md) containing instructions for an AI agent to execute the redesign implementation

## Requirements

### Requirement 1: Color System Transformation

**User Story:** As a user, I want the application to use Perplexity's dark color palette, so that the interface feels modern and reduces eye strain in low-light environments

#### Acceptance Criteria

1.1. THE UI_System SHALL replace all Light_Mode Color_Tokens with Perplexity_Aesthetic equivalents

1.2. THE UI_System SHALL set the primary background Color_Token to a value between #0A0A0A and #121212

1.3. THE UI_System SHALL set Surface Color_Tokens to values between #1A1A1A and #242424

1.4. THE UI_System SHALL preserve Gold_Accent as the primary interactive color for buttons, links, and focus states

1.5. THE UI_System SHALL use neutral gray values (#A0A0A0 to #E0E0E0 range) for body text on dark backgrounds

1.6. THE UI_System SHALL use subtle gray values (#404040 to #606060 range) for borders and dividers

1.7. THE UI_System SHALL maintain WCAG AA contrast ratios of at least 4.5:1 for body text and 3:1 for large text

1.8. THE UI_System SHALL remove all parchment, cream, and forest green Color_Tokens from the light theme palette

### Requirement 2: Theme Toggle Removal

**User Story:** As a developer, I want the theme toggle functionality removed, so that the application presents a single consistent dark interface

#### Acceptance Criteria

2.1. THE UI_System SHALL delete the Theme_Toggle component file from the codebase

2.2. THE UI_System SHALL remove all imports and references to Theme_Toggle from parent components

2.3. THE UI_System SHALL remove the ThemeContext provider if it exists and is only used for theme switching

2.4. THE UI_System SHALL remove all Light_Mode CSS rules and custom properties from Global_Styles

2.5. THE UI_System SHALL remove the `[data-theme="dark"]` selector and promote dark theme styles to root level

2.6. THE UI_System SHALL remove any theme-switching logic from client-side JavaScript code

### Requirement 3: Component Visual Redesign

**User Story:** As a user, I want all UI components to follow Perplexity's design patterns, so that the interface feels cohesive and professional

#### Acceptance Criteria

3.1. THE UI_System SHALL update all 47 Component files to use Perplexity_Aesthetic styling patterns

3.2. THE UI_System SHALL replace rounded-squircle border radius values with standard rounded corners (4px to 12px range)

3.3. THE UI_System SHALL reduce shadow intensity to subtle values matching Perplexity's minimal elevation system

3.4. THE UI_System SHALL update card backgrounds to use Surface Color_Tokens with minimal borders

3.5. THE UI_System SHALL update button styles to match Perplexity's flat, high-contrast button design

3.6. THE UI_System SHALL update input field styles to use dark backgrounds with subtle borders

3.7. THE UI_System SHALL update typography hierarchy to match Perplexity's font sizing and weight system

3.8. THE UI_System SHALL remove decorative elements like bezel effects, inner highlights, and concentric borders

3.9. THE UI_System SHALL update icon colors to use neutral grays with Gold_Accent for active states

3.10. THE UI_System SHALL update spacing to match Perplexity's generous whitespace patterns

### Requirement 4: Page Layout Redesign

**User Story:** As a user, I want all application pages to use Perplexity's layout patterns, so that navigation and content hierarchy are clear

#### Acceptance Criteria

4.1. THE UI_System SHALL update all 8 Page components to use Perplexity_Aesthetic layout patterns

4.2. THE UI_System SHALL update the home page (page.tsx) to match Perplexity's search-focused landing design

4.3. THE UI_System SHALL update the chat interface (chat/[conversationId]/page.tsx) to match Perplexity's conversation layout

4.4. THE UI_System SHALL update the results page (results/[id]/page.tsx) to match Perplexity's answer display format

4.5. THE UI_System SHALL update the history page (history/page.tsx) to match Perplexity's list view design

4.6. THE UI_System SHALL update the insights page (insights/page.tsx) to use dark-themed data visualization

4.7. THE UI_System SHALL update the compare page (compare/page.tsx) to use Perplexity's side-by-side layout patterns

4.8. THE UI_System SHALL update the resources page (resources/page.tsx) to use dark card grids

4.9. THE UI_System SHALL update the shared analysis page (share/[token]/page.tsx) to match Perplexity's public share view

4.10. THE UI_System SHALL preserve all existing page functionality and routing behavior

### Requirement 5: Global Styles Refactoring

**User Story:** As a developer, I want the globals.css file restructured for the new design system, so that styles are maintainable and consistent

#### Acceptance Criteria

5.1. THE UI_System SHALL remove all Ethiopian heritage design system comments and documentation from Global_Styles

5.2. THE UI_System SHALL remove all Light_Mode CSS custom properties from the :root selector

5.3. THE UI_System SHALL move all Dark_Mode CSS custom properties from `[data-theme="dark"]` to :root

5.4. THE UI_System SHALL remove the bezel-shell, bezel-core, and bezel-related component classes

5.5. THE UI_System SHALL remove the island button component classes

5.6. THE UI_System SHALL remove the eyebrow component class

5.7. THE UI_System SHALL remove the drop-cap and editorial-rule utility classes

5.8. THE UI_System SHALL update the card component class to use minimal Perplexity_Aesthetic styling

5.9. THE UI_System SHALL update button component classes to match Perplexity's button design

5.10. THE UI_System SHALL update input component classes to use dark backgrounds with subtle borders

5.11. THE UI_System SHALL simplify the design system to focus on utility-first Tailwind patterns

### Requirement 6: Typography System Update

**User Story:** As a user, I want text to be highly readable on dark backgrounds, so that I can comfortably read legal content

#### Acceptance Criteria

6.1. THE UI_System SHALL update body text color to a neutral gray value between #D0D0D0 and #E8E8E8

6.2. THE UI_System SHALL update heading text color to white (#FFFFFF) or near-white (#F5F5F5)

6.3. THE UI_System SHALL update secondary text color to a muted gray between #A0A0A0 and #B0B0B0

6.4. THE UI_System SHALL maintain the Plus Jakarta Sans font family for body text

6.5. THE UI_System SHALL maintain the Fraunces font family for display headings

6.6. THE UI_System SHALL update font weights to match Perplexity's hierarchy (400 for body, 500-600 for emphasis, 700 for headings)

6.7. THE UI_System SHALL update line heights to match Perplexity's generous spacing (1.6 for body, 1.2 for headings)

### Requirement 7: Interactive State Design

**User Story:** As a user, I want interactive elements to provide clear visual feedback, so that I understand what is clickable and what state it is in

#### Acceptance Criteria

7.1. WHEN a user hovers over an interactive element, THE UI_System SHALL display a subtle background color change

7.2. WHEN a user hovers over a button, THE UI_System SHALL display Gold_Accent color or a brightened surface

7.3. WHEN a user focuses an element via keyboard, THE UI_System SHALL display a Gold_Accent focus ring

7.4. WHEN a user clicks an interactive element, THE UI_System SHALL display a subtle scale-down animation

7.5. THE UI_System SHALL use Gold_Accent for active navigation items and selected states

7.6. THE UI_System SHALL use reduced opacity (0.5 to 0.6) for disabled interactive elements

7.7. THE UI_System SHALL remove all theme-specific hover states that reference Light_Mode colors

### Requirement 8: AI Implementation Prompt Generation

**User Story:** As a developer, I want a detailed AI agent prompt document, so that the redesign can be implemented systematically by an AI assistant

#### Acceptance Criteria

8.1. THE UI_System SHALL generate a prompt.md file in the spec directory

8.2. THE AI_Prompt SHALL include a complete overview of the redesign scope and objectives

8.3. THE AI_Prompt SHALL include specific color values for all Color_Tokens to be changed

8.4. THE AI_Prompt SHALL include a prioritized list of all 47 Components to be updated

8.5. THE AI_Prompt SHALL include before/after examples for key component patterns

8.6. THE AI_Prompt SHALL include specific instructions for removing Theme_Toggle and related code

8.7. THE AI_Prompt SHALL include instructions for updating Global_Styles with specific class names to modify

8.8. THE AI_Prompt SHALL include instructions for updating all 8 Page components

8.9. THE AI_Prompt SHALL include verification steps to confirm the redesign is complete

8.10. THE AI_Prompt SHALL include instructions to preserve all existing functionality and only modify visual presentation

8.11. THE AI_Prompt SHALL be structured in a clear, sequential format suitable for AI agent execution

### Requirement 9: Design Consistency Validation

**User Story:** As a designer, I want the redesign to maintain visual consistency across all pages, so that the application feels professionally designed

#### Acceptance Criteria

9.1. THE UI_System SHALL use consistent Surface Color_Tokens across all card and panel components

9.2. THE UI_System SHALL use consistent border radius values across all components (4px, 8px, or 12px only)

9.3. THE UI_System SHALL use consistent spacing scale values (4px, 8px, 12px, 16px, 24px, 32px, 48px)

9.4. THE UI_System SHALL use consistent shadow values across all elevated components

9.5. THE UI_System SHALL use Gold_Accent consistently for all primary actions and interactive states

9.6. THE UI_System SHALL use consistent icon sizing (16px, 20px, 24px) across all components

9.7. THE UI_System SHALL use consistent typography scale across all text elements

### Requirement 10: Functionality Preservation

**User Story:** As a user, I want all existing features to work exactly as before, so that the redesign does not disrupt my workflow

#### Acceptance Criteria

10.1. THE UI_System SHALL preserve all existing API routes and backend integration points

10.2. THE UI_System SHALL preserve all existing form submission and validation logic

10.3. THE UI_System SHALL preserve all existing navigation and routing behavior

10.4. THE UI_System SHALL preserve all existing state management and data fetching logic

10.5. THE UI_System SHALL preserve all existing accessibility attributes and ARIA labels

10.6. THE UI_System SHALL preserve all existing keyboard shortcuts and interactions

10.7. THE UI_System SHALL preserve all existing error handling and loading states

10.8. THE UI_System SHALL preserve all existing animation and transition behaviors (with updated colors)

10.9. THE UI_System SHALL preserve all existing responsive breakpoints and mobile layouts

10.10. THE UI_System SHALL exclude all admin pages (admin/page.tsx, admin/login/page.tsx) from redesign scope
