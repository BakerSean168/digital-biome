# Changelog

All notable Digital Biome changes are documented here.

The project follows Semantic Versioning for repository releases. Performance numbers are build
artifact measurements, not synthetic browser timing claims.

## [Unreleased]

### Added

- Phase 3 adds structural build gates for About markup density so the full tag directory and contribution
  heatmap cannot regress to per-item SVG/tooltip subtrees.

### Changed

- `/about/tags` keeps the complete SSR tag directory but replaces one Lucide SVG per tag and long repeated
  utility-class payloads with compact semantic links and component-scoped CSS.
- The GitHub contribution heatmap on `/about` now renders one compact SSR cell per day and projects the
  hover tooltip from `data-tooltip`, instead of repeating a tooltip DOM subtree for every contribution day.
- The generated Pagefind surface now prunes default UI, modular UI, and standalone highlight bundles that
  have no runtime owner in Digital Biome's custom typed search adapter; `pagefind.js`, WASM, and index metadata
  remain intact. The Tools E2E synchronization was also corrected to observe the real lazy-load response rather
  than racing the IntersectionObserver with a button click.

### Performance

Phase 3 markup-density measurements use the same committed tag/contribution snapshot before and after the
change. `/about` raw HTML fell from 358.15 KiB to 147.40 KiB (-58.8%) and DOM elements from 2660 to 1176
(-55.8%); gzip fell from 20.76 KiB to 18.75 KiB (-9.6%). `/about/tags` raw HTML fell from 651.27 KiB to
125.13 KiB (-80.8%), DOM elements from 4277 to 1478 (-65.4%), and gzip from 15.80 KiB to 12.31 KiB
(-22.1%). The full 700-tag SSR directory remains present, while SVG count on that page fell from 703 to 3.

Pagefind generated-artifact pruning removes 161.1 KiB of unused files from each production build. Total dist
JavaScript falls from 209.5 KiB to 69.7 KiB (-66.7%) and CSS from 179.5 KiB to 157.9 KiB (-12.0%). This is an
artifact/deployment-surface reduction, not a claim that initial page transfer was 161.1 KiB smaller: those default
UI files were already unreferenced by the rendered site.

## [0.2.0] - 2026-09-10

### Added

- Phase 2 restores focused regression coverage for Cloudflare Access/private handlers, note routing,
  wikilink parsing, Markdown transforms, visibility, and asset-card projection.
- Focused Playwright Chromium E2E now exercises the production-built Notes lazy catalog and URL filters,
  SiteSearch Pagefind integration, Discover's asset fallback, and the Tools lazy catalog/category state.

### Changed

- Removed the unused `mdast` runtime stub and `@pagefind/default-ui`; type-only mdast imports remain
  backed by `@types/mdast`, and Pagefind continues to use the custom typed adapter.
- Notes list pages no longer render empty graph/outline columns; note detail pages expose an explicit
  back-to-Notes route, and title decoration now preserves frontmatter-derived text through DOM
  `textContent` rather than `innerHTML`.
- `/tools` now renders only 16 real bookmark cards into the initial HTML and lazy-loads the complete
  public catalog from `/data/tools-catalog.json` for search, category filtering, or continued browsing.
  The catalog is schema-validated, single-flight/retryable, and shares the existing bookmark repository
  as its publication authority.
- Bookmark favicon fallback no longer relies on inline `onerror` code or raw custom-icon HTML; static
  and deferred cards use DOM event handling and text-only fallbacks.
- Notes now exposes a visible clear-filter action whenever query/tag filters are active and keeps `q`/`tag`
  URL state synchronized, so clearing filters remains stable across refresh/navigation.
- Search intent scheduling now wraps browser timer methods instead of storing unbound host functions, fixing
  the production `TypeError: Illegal invocation` that prevented SiteSearch results from rendering.
- Tag and asset indexes are now rebuilt from the final reconciled Notes snapshot before asset-specific
  enrichment, eliminating the split where 40 of 82 asset entries still carried pre-reconciliation metadata.
- The production deploy verifier now regenerates Digital Biome's gitignored derived indexes from the
  already hash-verified pinned Vault before running infrastructure contracts in a fresh checkout.


### Performance

DB-P2-201 was measured against the same 19-category / 180-assignment content set before and after
implementation. `/tools` raw HTML fell from 633.96 KiB to 63.46 KiB (-90.0%); gzip HTML fell from
34.21 KiB to 8.19 KiB (-76.1%). The deferred tools catalog is 47.75 KiB raw / 14.75 KiB gzip. The
BookmarkGrid client chunk grew from 4.28 KiB raw / 1.57 KiB gzip to 10.65 KiB / 3.76 KiB to own
lazy loading, filtering, keyboard navigation, safe dynamic DOM construction, and recovery behavior.
The initial HTML + grid JavaScript raw footprint still falls by about 88.4%.

### Validation

- Final Phase 2 implementation merged through PRs #62-#65; all exact-head GitHub checks passed.
- Final local gates: edge 32/32, unit 109/109, infrastructure 36/36, Playwright Chromium 5/5.
- Production artifact gates retain the private-data leak scan and hard HTML/JS/CSS/catalog budgets.
- Current-vault authority contracts: 720 tag entries with zero drift and 82 asset entries with zero
  generic metadata drift after reconciliation (down from 40/82 drift before the derived-index fix).
- Legacy PRs #46-#48 were closed after their valid work was migrated; rejected portions were not revived.

## [0.1.0] - 2026-09-10

### Added

- A lazy public Notes catalog at `/data/notes-catalog.json`, with exactly 12 real public NoteCards
  rendered into the initial `/notes` HTML.
- Shared typed browser modules for Notes filtering/pagination, request supersession, Pagefind loading
  and hydration, Discover search/fallback behavior, and safe excerpt normalization.
- Reusable `pnpm verify` and `pnpm verify:full` engineering gates.
- Hard performance budgets for key HTML routes, total JavaScript/CSS output, and the deferred Notes
  catalog, plus structural checks that prevent the full catalog from leaking back into `/notes`.
- Focused regression coverage for Notes lifecycle/recovery, Pagefind failures, stale async searches,
  Discover data-island parsing/classification, Tag Wall accessibility, and verification discovery.

### Changed

- `/notes` now pays only for the first 12 cards on initial navigation; search, tag filtering, and
  further pagination load the catalog on demand instead of embedding the entire knowledge base in
  the page script.
- The About hero Tag Wall is bounded to a representative set while `/about/tags` remains the full
  directory. Duplicate marquee content is hidden from assistive technology and keyboard focus.
- Site Search and Discover now share one typed Pagefind adapter instead of maintaining separate
  loader/init/hydration implementations.
- Discover uses a safe versioned data island and exact normalized asset matching rather than loose
  substring classification.
- PR verification now includes the production build, Pagefind generation, private-data leak scan,
  and performance budgets before merge.
- Public server telemetry now consumes Nezha v2's anonymous `/api/v1/ws/server` stream behind a short
  Cloudflare edge cache instead of retaining a long-lived dashboard PAT in the deployment.
- `AGENTS.md` and touched implementation details were aligned with the current Cloudflare Pages,
  Thought Forest, and verification topology.

### Performance

The Phase 1 baseline was measured before implementation, and the final candidate was measured from
one production build of the integrated branch. KiB uses 1024 bytes.

| Artifact | Before | v0.1.0 | Change |
| --- | ---: | ---: | ---: |
| `/notes` raw HTML | 1089.4 KiB | 47.8 KiB | -95.6% |
| `/notes` gzip HTML | 286.6 KiB | 9.4 KiB | -96.7% |
| `/about` raw HTML | 779.5 KiB | 358.1 KiB | -54.1% |
| `/about` gzip HTML | 31.4 KiB | 21.3 KiB | -32.2% |
| dist JavaScript | 187.9 KiB | 202.8 KiB | +7.9% (bounded to 250 KiB) |
| dist CSS | 176.2 KiB | 176.3 KiB | ~0% (bounded to 220 KiB) |

The final Notes catalog is 1260.6 KiB, but it is deferred rather than embedded in the initial Notes
HTML and is bounded to 1400 KiB. The final build produced 3512 pages; Pagefind indexed 3512 pages and
45219 words; the private-infrastructure leak scan checked 130 sensitive values successfully.

### Validation

- Final integrated implementation head: `8a2ea3335a85cad7904a02e8f13e32e002ca0cc6`.
- Integration merge on `main`: `f6f7fc03bc3a2aee0c38ac18d79fe7f11065fe8b` (PR #59).
- Final implementation tests: edge 19/19, unit 47/47, infrastructure 6/6.
- Final production build, Pagefind generation, private-data leak scan, and every performance budget
  passed.
- Local artifact smoke returned HTTP 200 for `/notes`, Notes `q`/`tag` URLs, `/about`, `/discover`,
  the Notes catalog, and Pagefind runtime; `/notes` contained exactly 12 SSR cards and no inline full
  catalog.
- Official Reviewer findings on the final repair cycle were resolved before merge; the exact PR head
  and the resulting `main` merge commit both passed GitHub CI.
