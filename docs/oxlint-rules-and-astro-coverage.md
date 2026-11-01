# Oxlint trial and Astro script coverage (DB-Q05)

Related: [#178](https://github.com/BakerSean168/digital-biome/issues/178), parent [#172](https://github.com/BakerSean168/digital-biome/issues/172). This follows the separate Oxfmt migration [#177](https://github.com/BakerSean168/digital-biome/issues/177).

## Decision

**Run Biome and Oxlint together. Do not replace Biome with Oxlint.**

- Biome 2.5.13 remains the existing recommended TS/JS lint owner, with its existing per-test rule overrides and no formatter.
- Project-local Oxlint 1.90.0 checks the same JS/TS roots plus supported standalone entry points. Its default Rust-backed ESLint, TypeScript, Unicorn and Oxc plugins are pinned explicitly in .oxlintrc.json. All warnings fail the gate.
- Oxfmt 0.75.0 remains the only formatter; Astro check remains the Astro template/frontmatter and TypeScript diagnostic owner. No type-aware Oxlint/TypeScript 7 migration was introduced here.
- The repository command pnpm lint runs the three checks sequentially: lint:biome, lint:oxlint and lint:astro. The existing pnpm quality and pnpm verify:full call this exact lint contract, so the required GitHub check workflow receives the same coverage without an additional independent job.

## Measured baseline versus migrated gate

| Evidence                    | Before this PR                                              | After this PR                                                      |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Biome                       | 228 TS/JS files in the pinned main baseline                 | 230 files, zero warnings/errors; existing recommended rules remain |
| Oxlint                      | Not part of quality gate                                    | 278 JS/TS/recognized files, 96 enabled rules, zero warnings/errors |
| Astro script coverage       | Astro check owns templates and types; no explicit lint gate | 14 executable script blocks from 48 Astro files linted by Oxlint   |
| Legacy formatter exemptions | 69 SHA-frozen files                                         | 67, after graduating exactly two edited legacy files               |

All counts are snapshots of this PR's scoped worktree. They are not hard-coded file totals or permanent quotas.

## Oxlint diagnostics reviewed and resolved

The read-only Oxlint baseline over the current source found seven warning diagnostics across five source/test files:

| Rule                                   | Count | Disposition                                                                                                                                                                                                        |
| -------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| eslint/no-unused-expressions           |     3 | Converted side-effect-only ternary expressions in terminal-objects.ts and terminal-facets.ts into equivalent if/else calls. Search parameter updates and facet toggles retain the same arguments and side effects. |
| eslint/no-unused-vars                  |     2 | Marked intentionally omitted destructured range fields in wikilink-parser.test.ts with underscore aliases.                                                                                                         |
| unicorn/prefer-string-starts-ends-with |     1 | Replaced an anchored literal-prefix regex with String.startsWith in markdown-transform.ts.                                                                                                                         |
| unicorn/no-useless-length-check        |     1 | Removed a redundant empty-array test: Array.every already returns true on an empty array in note-list-item.ts.                                                                                                     |

The two changed historic files were formatted with the already-pinned Oxfmt and their hashes were removed from scripts/format-baseline.json. The other 67 unchanged historical exemptions retain their exact bytes. No other business or published-data source was intentionally reformatted.

## Astro script liveness gate

Native Oxlint 1.90.0 recognizes an explicit .astro file as a scanned path, but a local controlled fixture containing an unused variable in an inline <script> returned zero diagnostics. Merely listing .astro files in Oxlint's arguments is therefore **not sufficient evidence** of script linting in this environment.

The project uses its existing pinned @astrojs/compiler-rs 0.5.2 parser to enumerate actual JSX <script> nodes, including scripts nested in templates and is:inline scripts. Each script's source text is written to an isolated temporary TypeScript file, with preceding blank lines to preserve source line locations; the locally pinned Oxlint binary checks those virtual files with --deny-warnings. Diagnostic file names are mapped back to their original Astro source paths. Temporary files are always removed. Discovery fails closed if no scripts are found or the expected scanned-file count differs.

Three new tests in scripts/lint-astro-scripts.test.ts verify that a deliberately invalid Astro inline script fails, a valid inline script passes, and the real current site contains and checks executable script blocks. Oxlint does not lint Astro markup and the dedicated bridge does not lint frontmatter: Astro check keeps that separate responsibility. This is a measured fallback, not a claim of full Astro framework lint coverage.

## Rule mapping and why Biome stays

| Concern                                         | Biome recommended                                | Oxlint default                                                         | Project policy                                                              |
| ----------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Suspicious patterns and unused expressions      | Existing recommended rules                       | eslint/no-unused-expressions, unicorn correctness and related rules    | Both run; the overlap is accepted instead of disabling an unknown rule set. |
| TypeScript non-null assertions and explicit any | Biome rules and existing test exceptions         | TypeScript plugin coverage is not assumed to match Biome configuration | Preserve Biome rules and per-test overrides.                                |
| Test globals and source-specific restrictions   | Existing Biome TS/JS includes and test overrides | Oxlint scans TS/JS roots under its built-in plugins                    | Do not delete the Biome config or disable warnings to accommodate a tool.   |
| Astro templates and frontmatter                 | Astro check (not Biome's current includes)       | Oxlint does not perform full template lint                             | Keep Astro check, plus explicit executable script lint.                     |
| Formatter, import/utility class ordering        | Oxfmt with project configuration                 | Oxlint is not a formatter                                              | No double-formatting or automatic class rewrites.                           |

The default recommended rule sets are **not** declared equivalent. Biome and Oxlint operate independently and their behavior can change across future upgrades; versions are pinned and the tests assert command ownership and Astro error detection.

## Reproduce / rollback

Use the repository-local tools after installing the frozen lockfile:

    pnpm install --frozen-lockfile
    pnpm lint
    pnpm format:check
    pnpm sync:data-products
    pnpm verify:full
    pnpm test:e2e

To inspect only the Astro scripts, run pnpm lint:astro. To inspect Oxlint's standalone TS/JS findings, run pnpm lint:oxlint. Neither command is a substitute for pnpm check on templates and types.

If the trial fails in production CI, revert the scoped DB-Q05 PR and reinstall from the restored lockfile. That removes the new Oxlint checks and minimal scoped linter findings without changing the Oxfmt migration, data-product locks or release/promotion logic. Never weaken Cloudflare Access or skip the existing quality gate to work around a tool issue.
