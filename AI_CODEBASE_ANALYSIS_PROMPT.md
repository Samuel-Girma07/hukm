# Codebase Analysis & Planning Prompt

You are tasked with analyzing an existing codebase to:
1. **Understand** the architecture and implementation
2. **Verify** that everything works correctly
3. **Plan** improvements and additions

**CRITICAL CONSTRAINTS:**
- DO NOT modify any existing code
- DO NOT create new files
- DO NOT run commands that change state
- ONLY read, analyze, test, and document

---

## Phase 1: Codebase Understanding

### 1.1 Project Overview
Read and analyze:
- README.md - Project description and setup
- package.json - Dependencies and scripts
- tsconfig.json - TypeScript configuration
- .env.example - Required environment variables

**Document:**
- What is the primary purpose of this application?
- What technologies/frameworks are used?
- What are the main dependencies?

### 1.2 Architecture Analysis
Explore the directory structure:

**App Structure (app/ directory):**
- Read all route files in app/api/
- Read all page components in app/
- Understand the routing structure (Next.js App Router)

**Components (components/ directory):**
- List all React components
- Understand component responsibilities
- Identify component dependencies

**Library Code (lib/ directory):**
- Read each module in lib/
- Understand core business logic
- Map dependencies between modules

**Scripts (scripts/ directory):**
- Identify utility scripts
- Understand their purposes (ingestion, testing, debugging)

**Tests (__tests__/ directory):**
- Review existing test coverage
- Understand what is being tested

**Document:**
- High-level architecture diagram (in text/markdown)
- Data flow through the application
- Key modules and their responsibilities
- External service integrations (APIs, databases)

### 1.3 Deep Dive: Core Functionality

Read and analyze these critical files:

**API Routes:**
- app/api/analyze/route.ts
- app/api/chat/route.ts

**Core Libraries:**
- lib/rag.ts - RAG (Retrieval-Augmented Generation) implementation
- lib/nvidia.ts - NVIDIA API integration
- lib/models.ts - Model configurations
- lib/parser.ts - Document parsing logic
- lib/systemPrompt.ts - System prompt generation
- lib/session.ts - Session management
- lib/rateLimit.ts - Rate limiting
- lib/logger.ts - Logging utilities
- lib/types.ts - TypeScript type definitions

**Document for each module:**
- Purpose and responsibility
- Key functions/classes
- Input/output contracts
- Dependencies on other modules
- External service calls

### 1.4 Data Layer Analysis

**Database:**
- Read supabase-setup.sql and supabase-conversations-setup.sql
- Understand database schema
- Identify tables, columns, relationships
- Understand vector embeddings setup

**Document:**
- Database schema diagram
- Table purposes
- Key relationships
- Vector search implementation

### 1.5 Frontend Analysis

**UI Components:**
- Read all components in components/
- Understand UI/UX patterns
- Identify state management approach

**Pages:**
- Analyze page components in app/
- Understand user flows
- Map component composition

**Document:**
- User journey flows
- Component hierarchy
- State management patterns
- UI/UX patterns used

---

## Phase 2: Verification & Testing

### 2.1 Static Analysis

**Check for issues:**
- Read through all TypeScript files for type errors
- Look for potential bugs or code smells
- Identify unused imports or dead code
- Check for security vulnerabilities (hardcoded secrets, SQL injection risks)

**Run (read-only commands):**
\\ash
# Check TypeScript compilation
npm run build

# Run linter
npm run lint

# Run existing tests
npm test
\\

**Document:**
- Any compilation errors
- Linting warnings/errors
- Test results (pass/fail counts)
- Identified code quality issues

### 2.2 Configuration Verification

**Check configurations:**
- .eslintrc.json - Linting rules
- next.config.mjs - Next.js configuration
- tailwind.config.ts - Tailwind CSS setup
- vitest.config.ts - Test configuration
- postcss.config.mjs - PostCSS setup

**Document:**
- Configuration completeness
- Potential misconfigurations
- Missing configurations

### 2.3 Dependency Analysis

**Analyze package.json:**
- Check for outdated dependencies
- Identify security vulnerabilities
- Look for unused dependencies
- Check for missing peer dependencies

**Document:**
- Dependency health report
- Security concerns
- Recommended updates (without making them)

### 2.4 Environment & Setup

**Review:**
- .env.example - Required environment variables
- SETUP_GUIDE.md - Setup instructions
- README.md - Documentation completeness

**Document:**
- Setup process clarity
- Missing documentation
- Environment variable requirements

---

## Phase 3: Test Coverage Analysis

### 3.1 Existing Tests Review

**Analyze test files in __tests__/:**
- models.test.ts
- parser.test.ts
- rateLimit.test.ts
- systemPrompt.test.ts

**Document:**
- What is currently tested
- Test quality (unit vs integration)
- Edge cases covered
- Mocking strategies

### 3.2 Coverage Gaps

**Identify untested code:**
- Critical paths without tests
- API routes without tests
- Complex logic without tests
- Error handling without tests

**Document:**
- Coverage percentage (if available)
- Critical gaps in test coverage
- High-risk untested areas

---

## Phase 4: Planning Improvements

### 4.1 Code Quality Improvements

**Identify opportunities for:**
- Better error handling
- Improved type safety
- Code deduplication
- Better separation of concerns
- Performance optimizations
- Security hardening

**Document as a prioritized list:**
- Issue description
- Current state
- Proposed improvement
- Impact (high/medium/low)
- Effort (high/medium/low)

### 4.2 Feature Additions

**Based on the codebase, suggest:**
- Missing features that would enhance functionality
- User experience improvements
- Developer experience improvements
- Monitoring/observability additions
- Documentation improvements

**Document each suggestion:**
- Feature description
- User value
- Technical approach (high-level)
- Dependencies/prerequisites
- Estimated complexity

### 4.3 Architecture Improvements

**Suggest improvements to:**
- Module organization
- API design
- Database schema
- Caching strategy
- Error handling patterns
- Logging strategy

**Document:**
- Current limitation
- Proposed architecture change
- Benefits
- Migration considerations

### 4.4 Testing Strategy

**Propose:**
- Additional unit tests needed
- Integration tests needed
- E2E tests needed
- Performance tests needed
- Load tests needed

**Document:**
- Test type
- What should be tested
- Why it is important
- Suggested testing tools/frameworks

### 4.5 Documentation Improvements

**Identify gaps in:**
- Code comments
- API documentation
- Setup guides
- Architecture documentation
- Deployment documentation

**Document:**
- What is missing
- Where it should be added
- Suggested content outline

---

## Phase 5: Final Deliverables

Create a comprehensive report with these sections:

### 5.1 Executive Summary
- Project overview
- Overall health assessment
- Top 3-5 priorities

### 5.2 Architecture Documentation
- System architecture diagram
- Data flow diagrams
- Component relationships
- Technology stack summary

### 5.3 Verification Report
- Build status
- Test results
- Code quality metrics
- Security findings
- Configuration issues

### 5.4 Improvement Roadmap

**Organized by priority:**

**P0 (Critical - Do First):**
- Security issues
- Breaking bugs
- Critical missing tests

**P1 (High Priority):**
- Important features
- Significant code quality issues
- Important test coverage gaps

**P2 (Medium Priority):**
- Nice-to-have features
- Refactoring opportunities
- Documentation improvements

**P3 (Low Priority):**
- Minor enhancements
- Code style improvements
- Optional optimizations

### 5.5 Detailed Improvement Plans

For each improvement, provide:
\\markdown
## [Improvement Title]

**Category:** [Code Quality / Feature / Architecture / Testing / Documentation]
**Priority:** [P0 / P1 / P2 / P3]
**Effort:** [Small / Medium / Large]
**Impact:** [High / Medium / Low]

**Current State:**
[Describe what exists now]

**Proposed Change:**
[Describe what should be 
