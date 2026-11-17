# Roadmap — Digital Biome

Updated: 2026-11-17. This is the repository-local roadmap, **not** a complete export of the GitHub Projects board (the current token lacks `read:project`).

## Delivery boundaries

- **Current architecture**: Astro static knowledge garden, Blog, Projects, Uses, About, Now, Personal Systems and Infrastructure. See [architecture](docs/architecture.md).
- **Draft PR #255 (not published)**: Home simplification; About and Now as self-contained slash pages; unified Uses catalog; canonical `/projects`; typed Now activity cards and code-size guard.
- Retired surfaces: the old Dashboard/BiomeTree UI and the old in-site Resume page are **not** current homepage features. Avoid reintroducing them from historical checklists.

## Next actions

| Priority | Item                                                         | Status               | Evidence / next action                                                                              |
| -------- | ------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------- |
| P1       | Review and publish PR #255                                   | Pending review       | Confirm protected CI and visual acceptance; follow Release → Production Promotion.                  |
| P1       | Enforce ≤500 lines per maintained code file                  | Implemented in PR    | `scripts/code-size-contract.test.ts`; included in `pnpm verify` via infrastructure tests.           |
| P2       | Component/ownership audit                                    | Reviewed             | [2026-11-17 maintainability review](docs/reviews/now-about-and-code-maintainability-2026-11-17.md). |
| P2       | Split InfrastructureShowcase by lifecycle/topology ownership | Deferred             | 396-line component; split only with privacy and E2E parity.                                         |
| P2       | Split mixed critical-path E2E scenarios                      | Deferred             | Current test file is 435 lines; retain behavioral coverage.                                         |
| P2       | RSS, Umami visits and image optimization                     | Backlog — revalidate | Historical suggestions from the old roadmap; do not claim current implementation without checking.  |
| P2       | Performance / SEO                                            | Ongoing              | Keep Pagefind, route privacy and HTML bundle budget checks in `pnpm verify:full`.                   |
| P3       | Comments / theme experiments                                 | Ideas                | No implementation started.                                                                          |

## Work protocol

1. Describe the change and acceptance criteria in a PR or Issue.
2. Preserve published routes, private/access boundaries, source projection contracts and GUI/TUI behavior.
3. Keep maintained source files within 500 lines; split by responsibilities, not arbitrary line chunks.
4. Run `pnpm verify:full` and `pnpm test:e2e` before merging.
5. Ship through the existing Candidate → Release → Production workflow; a green Draft PR does **not** mean the site is live.

Historical `v0.1.0` roadmap statuses are archived in Git history.
