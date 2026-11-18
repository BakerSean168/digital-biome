# Digital Biome — Now / About and code-maintainability review

Review date: 2026-11-17. Scope: draft branch for PR #255, not a production release.

## 1. Evidence and limits

- Inspected `src/`, `scripts/`, `functions/`, `edge/`, `e2e/`, `showcase/` and maintained browser assets.
- Counted maintained TypeScript, JavaScript, Astro, CSS and HTML files. Generated projections (`src/data/`), generated Pagefind output and JSON/content records are **not** application source-code modules.
- Initial maximum was **435 lines** (`e2e/critical-paths.spec.ts`), followed by **396** (`src/components/assets/InfrastructureShowcase.astro`), **386** (`e2e/resource-interactions.spec.ts`), **350** (`src/browser/terminal-browser-controller.ts`) and **330** (`scripts/sync/build-indexes.ts`).
- **No maintained code file exceeded 500 lines.** Added `scripts/code-size-contract.test.ts` to enforce the bound in the regular `test:infrastructure` suite.
- Scope is limited to maintained application code, component boundaries and existing regression coverage; unrelated project-management materials are excluded.

## 2. Verified findings and disposition

| Priority | Finding / evidence                                                                                                          | Disposition                                                                                                                | Verification / protected contract                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| P2       | `/now` had three hard-coded presentation groups and duplicated GUI/TUI item markup, plus navigation links in the page body. | **Fixed**: one typed `NOW_ENTRIES` array, reusable `NowEntry.astro`, flat peer records for project/game/watching.          | All seven requested records render in both modes; zero article links; no live tracking or private URLs.     |
| P2       | `/about` was functioning as a second navigation directory, with many About→Now/Blog/Projects/Uses links.                    | **Fixed**: body links removed; long-lived interests kept as text-only sections.                                            | Preserve About's four reading sections and shared anchors for GUI/TUI mode changes.                         |
| P2       | No mechanical 500-line policy, although all current maintained files passed.                                                | **Fixed**: repository-wide source line-count test.                                                                         | `test:infrastructure` fails for any maintained code module above 500 lines; generated data excluded.        |
| P2       | `InfrastructureShowcase.astro` at 396 lines combines public fleet, home topology and inventory markup.                      | **Deferred**: if infrastructure UI changes next, extract the fleet row and home topology sections into focused components. | Must preserve private-reference masking and Access behavior; compare existing infrastructure browser tests. |
| P2       | `terminal-browser-controller.ts` at 350 lines coordinates history, filters, selection, scrolling and loader state.          | **Deferred**: already delegates to loader/events/facets modules; avoid splitting arbitrarily.                              | Preserve browser state/history, cancellation, filters, GUI/TUI mode and permission contract.                |
| P3       | `e2e/critical-paths.spec.ts` at 435 lines groups unrelated search, mode and reading regressions.                            | **Deferred**: split by user journey when changing these tests next.                                                        | Keep existing Playwright coverage and test identities or migration mapping.                                 |
| P3       | `src/styles/gui.css` at 328 lines controls both page chrome and browser views.                                              | **Deferred**: review CSS ownership when extending modes, rather than moving selectors without layout tests.                | 320px and 390px mobile layouts, no horizontal overflow.                                                     |

## 3. Current Now content contract

- `project`: two independent entries, **MemoFlow** and **阿里三项目** (the latter is transcribed exactly as requested; the repository has no verified formal project description).
- `game`: League of Legends / MOBA, PUBG / Battle Royale, CS:GO / Tactical FPS, Dwarf Fortress / Simulation.
- `watching`: Breaking Bad / TV series only.
- Each record can be added, removed, recategorized or reordered in `src/config/now-profile.ts`. `NOW_UPDATED_AT` is manually updated; no live-game or streaming claims.
- About and Now articles contain no external or internal outbound links; the global site navigation remains the single access point to other slash pages.

## 4. Follow-up and acceptance

1. Complete local static/type, lint, source-line and browser checks for PR #255.
2. Confirm the same commit passes the protected GitHub CI; keep the PR Draft pending visual acceptance.
3. Only split the deferred modules when their owner area next changes, keeping current contracts and acceptance tests.
This report does not recommend any new production dependency or data source.
