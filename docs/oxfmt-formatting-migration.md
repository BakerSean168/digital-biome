# Oxfmt formatting authority (DB-Q04)

Migrated on 2026-11-01; tracker [#177](https://github.com/BakerSean168/digital-biome/issues/177), parent [#172](https://github.com/BakerSean168/digital-biome/issues/172).

## Decision and scope

- **Oxfmt 0.75.0** owns JS, TS, Astro, CSS, JSON, Markdown and YAML formatting. The pinned local binary is installed through pnpm install --frozen-lockfile, not globally.
- **@astrojs/compiler-rs 0.5.2** is an explicit development dependency. The .oxfmtrc.json enables Astro; without both, Astro formatting would not be guaranteed.
- Original Prettier options were migrated: 100-character print width, single quotes, semicolons and trailing commas. Import sorting and Tailwind class reordering remain off; sortPackageJson is explicitly false to prevent unrelated changes.
- **Biome remains the lint authority.** Astro check remains the Astro/TypeScript template and type gate. Oxlint is a separate future task (#178).

## Compatibility evidence

Compared Oxfmt's read-only --check against 230 files already accepted by Prettier. Only **two** previously clean TypeScript files had stylistic differences:

1. src/data/infrastructure/family-topology.ts: union type line breaks.
2. src/domain/infrastructure/infra-public-v2.ts: union type line breaks.

Only these two existing source files were reformatted for this migration. No TypeScript behavior, data projections, Tailwind CSS or Astro templates were rewritten. Samples of Astro, CSS, GitHub Actions YAML and JSON passed without changes. Astro formatting uses the bundled Prettier-compatible implementation with @astrojs/compiler-rs; see [official Oxfmt language support](https://oxc.rs/docs/guide/usage/formatter/language-support).

## Debt ratchet remains enforced

The script scripts/check-format-ratchet.ts still computes SHA-256 fingerprints for **69 unchanged legacy files** stored in scripts/format-baseline.json. Untouched historic files remain exempt; all new and modified files must pass the **project-local Oxfmt CLI**. A legacy file whose bytes change cannot be grandfathered again: format the changed file and remove its baseline entry in the same PR.

Do **not** run a full-repository Oxfmt write. That would rewrite grandfathered files and create noisy churn. Direct Prettier dependencies and its root configuration were removed only after the existing clean targets had been checked for Oxfmt compatibility.

## Local workflow

    pnpm install --frozen-lockfile
    pnpm format:check
    # Format a deliberately changed or new file, then graduate any legacy exemption.
    pnpm exec oxfmt --write path/to/file.ts
    pnpm verify

pnpm quality, the required GitHub CI and pnpm verify:full run the same format ratchet. GitHub CI path triggers include .oxfmtrc.json.

## Rollback

This migration uses one focused PR. If a renderer or formatter regression appears, revert the migration commit and reinstall the restored pnpm-lock.yaml. That restores the previous pinned Prettier CLI/plugin, configuration and checks without touching feature code or immutable public-data locks.

Future exceptions are removed one by one when a focused PR intentionally edits and formats the associated file.
