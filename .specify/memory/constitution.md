<!--
SYNC IMPACT REPORT
==================
Version change: N/A → 1.0.0 (initial creation)
Added principles:
  - I. Component-First Architecture
  - II. Performance & Bundle Optimization
  - III. Testing Discipline
  - IV. Simplicity
  - V. Documentation
Added sections:
  - Technology Stack
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ compatible (Constitution Check section present)
  - .specify/templates/spec-template.md: ✅ compatible (requirements aligned)
  - .specify/templates/tasks-template.md: ✅ compatible (phase structure aligned)
Follow-up TODOs: None
==================
-->

# Digital Biome Constitution

## Core Principles

### I. Component-First Architecture

All features MUST be built as Astro components following the Islands Architecture pattern.

- Static HTML by default; interactivity only where explicitly required
- Client-side JavaScript MUST be scoped to isolated "islands"
- Components MUST be self-contained with clear props interfaces
- No global state mutation outside of established patterns

**Rationale**: Islands architecture minimizes JavaScript payload and maximizes performance by shipping interactivity only where needed.

### II. Performance & Bundle Optimization

Performance is a feature, not an afterthought.

- Each page MUST pass Core Web Vitals thresholds (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Images MUST be optimized using Astro's built-in image handling
- Third-party scripts MUST be lazy-loaded or deferred
- Bundle size MUST be monitored; significant increases require justification

**Rationale**: Performance directly impacts user experience, SEO, and conversion rates.

### III. Testing Discipline

Test coverage MUST be maintained for critical user paths.

- Component tests for interactive islands MUST exist
- Integration tests MUST cover primary user journeys
- Visual regression tests SHOULD guard against unintended UI changes
- Tests MUST be runnable via `pnpm test` (when configured)

**Rationale**: Tests prevent regressions and enable confident refactoring.

### IV. Simplicity

Code MUST be as simple as possible, but no simpler.

- Abstractions MUST justify their existence with concrete use cases
- YAGNI (You Aren't Gonna Need It) applies to all decisions
- Prefer Astro-native solutions over third-party alternatives
- Remove unused code and dependencies promptly

**Rationale**: Simple code is easier to maintain, debug, and extend.

### V. Documentation

Code MUST be self-documenting; additional docs for public APIs and complex logic.

- Component props MUST be documented with TypeScript types
- Complex algorithms MUST include inline comments explaining "why"
- README MUST be updated when adding new dependencies or scripts
- Breaking changes MUST be documented before merge

**Rationale**: Future developers (including yourself) need to understand decisions quickly.

## Technology Stack

The following technologies are approved for use in this project:

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Astro 5.x | Islands architecture, static-first |
| Language | TypeScript | Strict mode enabled |
| Package Manager | pnpm | Required for consistency |
| Deployment | Netlify | Configured via @astrojs/netlify |
| Styling | CSS/Scoped | No external CSS framework required |

Adding dependencies outside this stack MUST be justified in the implementation plan.

## Governance

### Amendment Procedure

1. Proposed changes MUST be documented with rationale
2. Changes require review before merge
3. Version MUST be incremented per semantic versioning rules

### Versioning Policy

- **MAJOR**: Principle removal or redefinition
- **MINOR**: New principle or expanded guidance
- **PATCH**: Clarifications, typo fixes

### Compliance

- All features MUST pass Constitution Check in implementation plans
- Violations MUST be explicitly justified in Complexity Tracking
- Constitution supersedes inconsistent practices

**Version**: 1.0.0 | **Ratified**: 2026-02-22 | **Last Amended**: 2026-02-22
