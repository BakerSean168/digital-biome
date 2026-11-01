# Digital Biome engineering-quality baseline

- **Evidence date:** 2026-11-01
- **Reviewed Git revision:** `main@de94932b13e39ab351836d7d30229a93fad61e50`
- **Tracker:** [#172](https://github.com/BakerSean168/digital-biome/issues/172)
- **First characterization ticket:** [#173](https://github.com/BakerSean168/digital-biome/issues/173)
- **Scope:** current Astro source, generated public content contracts, Cloudflare Pages Functions, quality gates and built assets.
- **Non-goal:** changing the production release or removing code in this baseline ticket.

This is a record of **observed facts and candidate cleanup work**, not an authorization to
delete every file named below. A static-import graph does not prove the absence of dynamic
imports, build-time references or external consumers.

## Current ownership and protected user paths

| Area                     | Current authority                                                                                         | Protected behavior                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Page shell               | `src/layouts/BaseLayout.astro` / `TerminalLayout.astro`                                                   | Single HTML shell; `data-ui="tui"/"gui"` mode and navigation                                                                |
| Active object browser    | `src/components/terminal/ObjectBrowser.astro`, `src/browser/terminal-objects.ts`, `src/view-models/*`     | `/notes`, `/tools`, `/dev`, `/blog`, `/friends`, home: query, sort, focus, selection, scroll anchor, history, lazy catalogs |
| Public content and links | `src/domain/note-routing/*`, `src/repositories/*`, `src/pages/notes/[...slug].astro`                      | Canonical `obsidian/<relative-path>` ID, Wikilinks, backlinks, stable URLs and privacy filters                              |
| Search                   | `src/components/common/SiteSearch.astro`, `src/browser/{pagefind,search-intent}.ts`                       | Pagefind, navigation commands, public services, protected service bindings, keyboard/IME behavior                           |
| Public catalog data      | `src/pages/data/*`                                                                                        | `/data/notes-catalog.json`, `/data/tools-catalog.json`, `/data/terminal/*.json`, system launcher                            |
| Protected functions      | `functions/api/private/_middleware.ts`, `edge/access.ts`                                                  | Cloudflare Access identity verification; no private data in public SSR/JSON                                                 |
| Content projection       | `data-products/*.lock.json` and `scripts/data-products/*`                                                 | Exact immutable knowledge, infrastructure and PDS catalog Release identity and SHA-256                                      |
| Delivery                 | `scripts/delivery/*`, `.github/workflows/{check,candidate-publish,release-publish,deploy-production}.yml` | Manifest v3/v4/v5 compatibility and existing release → candidate → production flow                                          |

The new `scripts/engineering-quality-baseline.test.ts` deliberately protects the six
currently shared terminal-browser routes, the non-reintroduction of retired Dashboard
components into the **static page import graph**, and the existence of public data routes
and Access middleware. It is not a complete runtime bundle reachability analyzer. When an
intentional architecture migration changes these contracts, update the characterization
test in the same reviewed PR and explain why the contract remains protected.

## Versioned toolchain and quality baseline

| Tool/runtime                    | Observed version or condition                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Astro / TypeScript              | 5.16.9 / 5.9.3                                                                                             |
| Tailwind / Tailwind Vite plugin | 4.2.1 / 4.2.1                                                                                              |
| Cloudflare deployment           | Pages + Pages Functions, Wrangler 4.111.0                                                                  |
| Lint / formatting               | Biome 2.5.13, Prettier 3.9.6 + `prettier-plugin-astro` 1.0.0                                               |
| Format policy                   | `scripts/check-format-ratchet.ts`: 74 unchanged legacy file hashes temporarily exempted from Prettier      |
| Biome scope                     | 233 TS/JS files examined; `.astro` template script lint not explicitly covered by `biome.json`             |
| Astro diagnostics               | `pnpm check` type/content diagnostics, separate from lint                                                  |
| Browser coverage                | 2 Playwright spec files covering core Notes, Tools, Search, modes, history, access and mobile interactions |

After `pnpm sync:data-products`, `pnpm verify` passed: infrastructure 230 tests passed,
2 skipped, 0 failed; `pnpm check:performance` also passed against the existing build.
The corresponding main SHA's GitHub `check.yml` workflow passed. This baseline does
not imply that **every** possible flow, accessibility criterion or performance concern
has a dedicated test.

### Build artifact observations (previously generated `dist`)

- Approximately 3,811 prerendered HTML pages; `dist` total about 231 MiB.
- Total JS about 68.4 KiB; CSS about 128.8 KiB.
- The static notes catalog and per-page HTML dominate content size; the Notes and
  external Tools catalogs are lazy-loaded with bounded SSR prefixes (12 and 16).
- Existing per-page, CSS/JS and catalog size budgets passed. The existence of an
  unused asset in `dist` does **not** establish that browsers fetch it on the home page.

## Candidate legacy code: require call-site verification before deleting

| Candidate (current lines)                                                                            | Evidence                                                                                                                  | Next owner                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `src/components/dashboard/BiomeTree.astro` (622)                                                     | No reference found in current page static import chain                                                                    | #174                                     |
| `src/components/dashboard/BookmarkGrid.astro` (178) and `BookmarkCategory.astro` (93)                | Current Tools uses `ObjectBrowser`; old BookmarkGrid UI not imported by pages                                             | #174                                     |
| `src/layouts/DashboardLayout.astro` (59)                                                             | Current route shells use BaseLayout / TerminalLayout                                                                      | #174                                     |
| `src/browser/bookmark-grid.ts` (478) and `src/browser/notes-list.ts` (422)                           | Old controllers appear outside current route initialization chain, but their data adapters and tests have other consumers | #175                                     |
| `src/components/common/{Footer,GitHubContributions,LanguageToggle,ScrollingTagWall,ThemeIcon}.astro` | No static inbound production import discovered; one component has its own test                                            | #174 with follow-up scope as appropriate |
| `src/components/assets/{InfrastructureAtlas,InfrastructureNodePanel}.astro`                          | No static inbound production import discovered                                                                            | #183                                     |
| `src/styles/global.css` (1,208)                                                                      | Older Biome Tree styles mixed with current GUI/TUI; `.signal-decode` still consumed by `SignalTitle`                      | #176                                     |
| `public/assets/images/organic_biome_tree*.*` (3 assets, 3,904,401 B total)                           | Only `BiomeTree.astro` references its WebP in tracked source; all three appear in static `dist`                           | #176                                     |

Some other large files are **active**, not deletion candidates:
`src/browser/terminal-objects.ts` (573), `src/components/common/SiteSearch.astro`
(464), `src/components/assets/InfrastructureShowcase.astro` (458),
`PersonalSystemsHub.astro` (456), and `scripts/delivery/manifest.ts` (449).
Their dependencies, tests and state ownership must be preserved during later extraction.

## Reproduction and acceptance sequence

```bash
# Required: materialize exact pinned immutable public data products first.
pnpm sync:data-products

# Local tests + types + lint + format/debt policy.
pnpm verify

# Full release-like build, Pagefind and performance budget checks.
pnpm verify:full

# Run against generated preview; covers desktop/mobile and primary interactions.
pnpm test:e2e
```

When local ignored `.pds-runtime` assets were older than the committed
`knowledge-public-v1.lock.json`, a fixture-backed test failed with
`Release asset metadata digest mismatch`. The local artifact and manifest digests
were both different from the committed lock. Re-running `pnpm sync:data-products`
restored matching digests; the same `pnpm verify` passed. **Do not bypass SHA-256
verification** to suppress this failure. Since #184, `pnpm verify` starts with the
read-only, offline `pnpm preflight:data-products`, which reports `missing`, `stale`
(SHA-256 mismatch with the exact lock file, filename and digests), `invalid-lock` or
`invalid-publication` per product and prints `pnpm sync:data-products` as the only
recovery for cache states. It never edits locks, selects a newer Release or skips
integrity checks; CI still materializes before validating.

A subsequent `pnpm check` on the fully materialized tree had 0 errors,
0 warnings and 3 hints. A prior cold-content parse reported duplicate ID and Shiki
warnings, but these did not recur in the same synchronized tree. Root cause was
not established; do not call them persistent note ID collisions without reproduction.

## Engineering sequence / rollback gates

1. **#173:** characterize the present system (this task; no runtime changes).
2. **#174 → #175 → #176:** remove proven orphan UI and controllers, then stale CSS/assets;
   compare public catalog output and browser snapshots.
3. **#177 → #178:** run Oxfmt and Oxlint migrations in **separate** diffs; preserve
   types, Astro template checks and a reversible format-debt path.
4. **#179/#181/#180/#182/#183/#185:** split browser/data/manifest responsibilities
   with characterization tests, maintaining behavior and current export contracts.
5. **#186 → #187/#188 → #189:** major framework/tool updates only after earlier
   source boundaries are stable; require Cloudflare staging acceptance.

All changes must have one issue, one focused branch/PR, an explicit change list, tests
run with actual outputs, and CI acceptance. Do not merge unrelated mass formatting,
business logic changes and major dependency upgrades. The project currently passes
its quality and performance budgets; reducing maintenance cost, not rewriting the
framework, is the priority.
