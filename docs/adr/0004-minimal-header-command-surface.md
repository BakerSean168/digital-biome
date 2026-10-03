# ADR-0004: Keep the global header to Search and Access

- Status: Accepted
- Date: 2026-10-03
- Scope: Digital Biome global navigation chrome

## Context

Digital Biome has a floating global header that is visible across content, project, system, and infrastructure pages. As new top-level surfaces such as Personal Systems are introduced, adding a dedicated header button for each destination would gradually turn the header into a conventional navigation bar and compete with page content for attention.

The site already has a command/search palette that owns destination discovery and navigation. Personal Systems is indexed there with `/systems`, `/infrastructure`, `systems`, `infra`, `lab`, `ops`, and `services` aliases. Cloudflare Access is different from ordinary navigation because it represents a global authentication state and unlocks protected runtime data.

## Decision

For the current product phase, the global floating header has exactly two semantic controls:

1. **Search** — opens the command/search palette and is the entry point for destination navigation, including Personal Systems.
2. **Access** — represents authentication state and changes to Logout after Cloudflare Access authentication.

No third destination button is allowed in the global header. Personal Systems, Projects, Notes, Tools, Blog, Infrastructure, and future destination surfaces belong in the Search navigation index rather than permanent header chrome.

The machine-readable policy lives in `src/config/navigation-policy.ts`:

```ts
HEADER_CONTROLS = ['search', 'access'];
```

The same file owns `SEARCH_NAVIGATION_INDEX`, making it explicit that route discoverability and global chrome are separate concerns.

## Rationale

- Keeps the global chrome visually quiet and stable as the site grows.
- Avoids privileging whichever feature was added most recently.
- Gives Search one clear role as the navigation/command index.
- Keeps Access visible because authentication state affects protected data across multiple surfaces.
- Prevents route growth from causing header growth.

## Consequences

- A new top-level destination must be added to the Search navigation index instead of the header.
- Page-local links, breadcrumbs, and contextual calls to action remain allowed.
- The Access slot may visually change between Access and Logout without counting as a third control; it is one semantic authentication control.
- A future change to add a persistent third global control requires an explicit ADR update rather than an incidental component edit.

## Revisit triggers

Reconsider this decision only if Search ceases to be an effective navigation index, the site develops a small stable set of user-validated primary destinations that require one-click global access, or accessibility/usability evidence shows that the two-control model creates a material navigation problem.
