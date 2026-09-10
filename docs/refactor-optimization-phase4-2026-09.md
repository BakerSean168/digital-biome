# Digital Biome 系统性工程重构 — Phase 4（2026-09）

> 状态：已完成 / v0.4.0 release record
>
> 稳定基线：`v0.3.1` / `c302ac9`

## 1. 明确遗留范围

Phase 1-3 已完成 Notes/Tools 数据边界、索引 authority、浏览器 E2E、About markup density 与 Pagefind
artifact hygiene。Phase 4 只处理此前明确推迟的两项工程债务：

1. **DB-P4-101 Frontmatter parser ownership cleanup**：删除 Digital Biome 内两套手写 line scanner，统一到
   一个 full-YAML adapter，同时保持 Thought Forest 为 canonical published metadata authority。
2. **DB-P4-201 lint/format engineering contract**：以 check-only 方式建立 lint/format gate，不做全仓无语义
   formatter rewrite。

大组件仅因文件长不进入本轮。

## 2. DB-P4-101 — Frontmatter ownership

### 目标边界

- YAML 语法只由共享 adapter 解释；
- `build-indexes.ts` 只负责 route/filePath、publication flags、site-only fields、日期与 link extraction；
- `static-note-catalog.ts` 的 custom-root fallback 复用同一个 adapter；
- Thought Forest 继续覆盖 title/description/tags/aliases/type/status canonical metadata；
- asset nested metadata 继续由既有 upstream asset enrich 拥有，不借重构改变 notes-index schema；
- malformed YAML fail closed，而不是静默产生部分 metadata。

### 实施中发现的隐私修复

同一份 pinned Vault A/B 暴露出旧 line scanner 会把 quoted boolean `private: "true"` 解释为 false。
当前数据中有且仅有一篇笔记命中该形式，`v0.3.0` 因此错误生成了公开静态 route。共享 YAML adapter
会正确将其收窄为 private。

允许的最终索引差异因此严格限定为：

- notes-index：1 个条目的 `private: false -> true`、`visibility: public -> private`；
- tag-index：该私有笔记的 tags 不再计入 public tag counts；
- asset-index / link-graph：语义保持一致。

新增 production postbuild gate：任何 private/draft/private-visibility knowledge note 都不得在 `dist/notes/*`
存在静态 route。该修复优先以 patch release 发布，不等待 DB-P4-201。

### P4-101 最终本地验收证据

同一 pinned Vault 在 `v0.3.0` 旧 scanner 产物与共享 YAML adapter 产物之间比较：

- `notes-index`：仅 1 个条目发生语义变化，且只包含 `private false -> true` 与
  `visibility public -> private`；
- `asset-index`：语义完全一致；
- `link-graph`：语义完全一致；
- `tag-index`：仅因该笔记退出 public set 而减少对应 tag counts；
- production static pages：**3512 -> 3511**，没有额外 route 丢失；
- Pagefind：**3511 pages / 45172 words**；
- private infrastructure leak scan：**130 values PASS**；
- private route boundary：**16 protected knowledge notes checked / 0 leaked routes**；
- Chromium focused E2E：**6/6 PASS**。

由于 `v0.3.0` 生产环境已实际暴露该 protected route，P4-101 不等待后续 lint/format 工作，先作为
`v0.3.1` privacy patch 发布。Phase 4 的剩余 DB-P4-201 之后从该安全基线继续。

## 3. P4-101 patch closure — v0.3.1

P4-101 通过 PR #71 合入 main。由于它修复了 `v0.3.0` 上实际可访问的 protected route，先以
`v0.3.1` patch 独立发布；DB-P4-201 不与该隐私修复捆绑。

## v0.3.1 release blocker #2 — stale edge asset revocation

The first production deploy correctly removed the protected note from the new static artifact, but the canonical
custom domain returned 404 while the project `pages.dev` URL still served an older cached 200 response. The
response was an edge cache hit from before the privacy change, proving that build-time route exclusion alone is
not an immediate revocation boundary.

The hardened boundary now writes protected knowledge-note patterns into `dist/_routes.json` during postbuild.
A generic `functions/notes/obsidian/[[path]].ts` tombstone returns a non-cacheable 404 only for those generated
include rules; `/api/*` keeps its existing Function routing and public Notes remain static. No private slug is
committed into source. A fail-closed prefix-collision check prevents a protected wildcard from shadowing a public
note. Current production data emits 16 protected note rules plus the API rule, below Cloudflare Pages' 100-rule
limit.

Local workerd verification deliberately restored a stale static fixture underneath one protected route. Both
slash and non-slash requests still returned 404 with no stale marker, while `/notes/` remained 200.

## 4. DB-P4-201 — lint / format engineering contract

### Baseline audit

Phase 4 does not introduce a repository-wide formatter rewrite. Initial Prettier inspection found **170**
existing code/config files that would be rewritten, so a one-shot format commit would create a large
non-semantic diff. Biome recommended linting across the stable TS/JS/CJS/MJS surface initially reported
**23 errors / 59 warnings / 33 infos** across 138 files.

Implementation converges that surface to **0 errors / 0 warnings** and expands lint ownership to 141 files.
Test files explicitly relax only `noExplicitAny` and `noNonNullAssertion` for fixture/mocking ergonomics;
production code keeps the recommended rules. Info-only style migrations are not elevated to blockers.

Linting also exposed a third line-oriented YAML parser in `build-subscriptions.ts`. It now consumes the same
full-YAML adapter as other local Markdown consumers. The six-subscription normalized payload hash before/after
remains identical when `updatedAt` is excluded.

### Incremental formatting ratchet

Prettier 3 + the official Astro plugin owns formatting syntax, while Biome formatting remains disabled because
full Astro support is not the stable boundary used by this repository. The final local ratchet observes **206** code/config targets: **131** untouched legacy files remain temporarily
grandfathered by SHA-256 content hash, and **75** targets are already formatted or new.

The gate is intentionally monotonic:

- unchanged legacy bytes may keep existing style;
- once a legacy file changes, it must pass Prettier and its baseline entry must be removed;
- every new/non-baseline target must pass Prettier immediately;
- stale baseline entries fail so deleted/renamed files cannot leave debt records behind;
- `pnpm verify` starts with `pnpm quality`, which runs zero-warning Biome lint plus the format ratchet.

This allows formatting debt to shrink with normal feature work instead of hiding architectural changes inside a
170-file rewrite.

### P4-201 final local evidence

- Biome lint: **144 files / 0 errors / 0 warnings**;
- format ratchet: **206 targets = 75 formatted + 131 unchanged legacy**;
- Astro check: **181 files / 0 diagnostics**;
- edge: **33/33**; unit: **113/113**; infrastructure: **53/53**;
- subscription normalized payload: **6 entries**, stable hash identical before/after parser convergence;
- production build: **3511 pages**, Pagefind **3511 pages**;
- private infrastructure scan: **130 values PASS**; protected-route boundary/runtime manifest: **16 routes PASS**;
- existing performance budgets: PASS; focused Chromium E2E: **6/6**.

P4-201 is an engineering-quality contract, not a mass style rewrite. Release/version closure happens only after
its exact-head PR gate and final main production deployment succeed.

## 5. Phase 4 finalization — v0.4.0

Phase 4 closes the two explicit engineering debts carried from the original refactor audit:

- P4-101 / PR #71 + release blocker PR #73: one full-YAML adapter replaces duplicate local line scanners;
  quoted private flags fail closed, protected routes are absent from static/Pagefind output, and generated Pages
  runtime tombstones immediately revoke stale cached protected assets. This security correction shipped first as
  `v0.3.1`.
- P4-201 / PR #74: Biome owns the stable TS/JS lint surface with zero warnings, Prettier + the official Astro
  plugin owns formatting, and a SHA-256 ratchet lets the remaining 131 legacy formatting files converge only
  when touched instead of creating a repository-wide style rewrite. The final subscription-specific line YAML
  parser also moved onto the shared full-YAML adapter with unchanged normalized output.

Final P4-201 implementation evidence before release closure: Biome **144 files / 0 warnings**, format ratchet
**206 targets = 75 formatted + 131 grandfathered**, Astro **181 files / 0 diagnostics**, edge **33/33**, unit
**113/113**, infrastructure **53/53**, production build **3511 pages**, private leak scan **130 values PASS**,
protected-route manifest **16 routes PASS**, performance budgets PASS, Chromium **6/6**.

After `v0.4.0`, the original explicit refactor backlog no longer contains an unimplemented mandatory item.
Large components or future performance work require fresh evidence and a new phase; they are not inherited
completion debt from Phase 1-4.
