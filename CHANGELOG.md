# Changelog

All notable Digital Biome changes are documented here.

The project follows Semantic Versioning for repository releases. Performance numbers are build
artifact measurements, not synthetic browser timing claims.

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
