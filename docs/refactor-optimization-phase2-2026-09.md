# Digital Biome 系统性工程与性能优化 — Phase 2（2026-09）

> 状态：实施中
>
> 稳定基线：`v0.1.0` / `a5563ec`
>
> 下一版本目标：`v0.2.0`

## 1. 目标与边界

Phase 1 已把最明显的 Notes/About 首屏负担和 PR 质量门禁收敛，并以 `v0.1.0`
发布。Phase 2 不重做已经闭环的工作，而聚焦三个剩余事实：高风险代码缺少直接回归测试、
知识索引存在双解析/双事实源、以及 `/tools` 仍把完整资源目录一次性写入 HTML。

本轮继续遵守以下约束：

1. 不为了“文件小”机械拆组件；只有职责、测试或运行边界明确时才拆。
2. 不削弱 Thought Forest 的 private/internal 数据过滤，不把上游私有字段引入公开产物。
3. 不以 synthetic benchmark 代替 production artifact 指标；HTML/JS/CSS/JSON 均从真实 build 计量。
4. 每个高风险切片独立测试、独立 PR/CI；最终再统一做 exact-main build/deploy/release。
5. `v0.1.0` 是只读基线；Phase 2 变化进入 `[Unreleased]`，最终以 `v0.2.0` 收口。

## 2. v0.1.0 基线

Phase 1 最终 production artifact 的关键指标：

| Artifact | v0.1.0 |
|---|---:|
| `/notes` raw / gzip | 47.8 / 9.4 KiB |
| `/about` raw / gzip | 358.1 / 21.3 KiB |
| `/discover` raw / gzip | 36.3 / 7.9 KiB |
| `/tools` raw / gzip | **634.0 / 34.7 KiB** |
| dist JavaScript | 202.8 KiB |
| dist CSS | 176.3 KiB |
| deferred Notes catalog | 1260.6 KiB |
| generated pages | 3512 |
| Pagefind words | 45219 |

`/tools` 因 155 个 bookmark 在 11 个 category 中完整 SSR，成为下一处最明显的可减初始 DOM/HTML
候选。`/about/tags` 仍是明确的完整目录页面，gzip 成本低，本轮不会仅为 raw HTML 数字而分页。

## 3. Phase 2 审计结论

### P1 — 高风险逻辑已有旧测试成果，但未进入 main

旧 PR #47 包含 9 组、925 行 focused tests，覆盖：

- Cloudflare Access JWT/JWKS 安全门；
- private middleware / private infrastructure handler；
- note id / visibility / wikilink parser / slug resolver / URL builder；
- Markdown transform 与 YAML 风险归一化；
- asset-card view model。

这些路径在 Phase 1 后仍是现役事实源。测试已选择性迁入 Phase 2，而不是继续让旧 PR 漂浮。
迁入后 `pnpm verify` 当前结果为：edge **32/32**、unit **105/105**、infrastructure **24/24**。

### P1 — 索引生成仍有“双 YAML 解释”

当前 `pnpm sync` 先由 Thought Forest 的 `kb:index` 使用完整 YAML parser 生成
`generated/knowledge-index/*`，随后 Digital Biome 又在 `scripts/sync/build-indexes.ts` 中对同步后的
Markdown 使用自维护 line scanner 重新解析 frontmatter。之后又通过 `merge-asset-index.ts` /
`copy-upstream-indexes.ts` 把部分上游结果补回去。

当前结果已经直接表现出双源差异：

- local notes index：3489 entries；
- upstream notes index：3449 entries；
- local asset index：81 entries；
- upstream asset index：75 entries；
- local tag index：698 tags；
- upstream tag index：711 tags。

差异并不自动意味着哪一边错误，但说明当前架构需要“生成 → 再解析 → 再 merge/replace”的补丁式
闭环。Phase 2 必须建立明确 authority/parity contract 后才能删除 scanner，不能直接改成“全抄上游”。

### P1 — `/tools` 初始数据边界仍过大

`BookmarkGrid.astro` 在 build-time 将全部 155 个 bookmarks / 11 categories 展开成完整卡片 DOM，
客户端过滤只是隐藏已有节点。因此访问 `/tools` 即支付 634.0 KiB raw HTML，即使用户只看首屏或只
搜索一个类别。

目标与 Notes Phase 1 相同：首屏保留真实可访问内容，完整 catalog 延迟加载，并且只有一个公开
数据 authority。

### P2 — 缺少真实浏览器 E2E

Phase 1 已有 browser-port/unit contract 和 production HTTP smoke，但没有真实 Chromium DOM/interaction
测试。Notes lazy load、URL filter、SiteSearch Pagefind、Discover fallback、Tools filter 应至少有一条
production-build E2E 路径，避免“纯函数全绿但 DOM wiring 断掉”。

### P2 — 旧 PR / 依赖卫生

- PR #53：当前 main 已精确包含同一个 Thought Forest SHA，已关闭为 superseded。
- PR #46：`mdast` runtime stub 与 `@pagefind/default-ui` 仍无运行时 owner；选择性迁移删除，拒绝恢复
  `.hoplite` agent 配置。
- PR #47：高价值测试已迁移。
- PR #48：Notes 空侧栏与 back navigation 有效；其 `SignalTitle` 双 `aria-hidden` 建议会让 heading
  失去可访问名称，因此拒绝原样迁移。Phase 2 只迁移有效 UX，并将 Notes 动态 title 从
  `innerHTML` 改为 `textContent`/DOM 构造。

## 4. 实施图

### Batch A — Foundation / regression safety（当前实施）

#### DB-P2-001 — Recover high-risk regression coverage

- 迁移 PR #47 的 9 组 focused tests；
- 保证当前生产逻辑无需“迎合旧测试”改行为；
- `test:edge` / `test:unit` / `test:infrastructure` 自动发现新增 tests。

**Acceptance**：edge >=32、unit >=105、infrastructure >=24，全部 PASS。

#### DB-P2-002 — Remove provably unused runtime dependencies

- 删除 `mdast` runtime stub，保留真正用于 type-only import 的 `@types/mdast`；
- 删除未使用的 `@pagefind/default-ui` 与 dead declaration；
- lockfile 只允许对应依赖删除，不做顺手升级。

#### DB-P2-003 — Notes layout and safe title decoration

- `/notes` list 不再 SSR 空的 backlink/outgoing/outline columns；
- note detail 提供明确 `/notes` 返回入口；
- 去掉 decorative chips 的假 click affordance；
- title scramble 不再把 frontmatter-derived text 重新写入 `innerHTML`；
- 保留一个可访问文本 owner，不采用“双 aria-hidden”方案。

### Batch B — Index authority convergence

#### DB-P2-101 — Make index authority explicit

先增加 current-vault parity report，再决定字段 authority：

1. 对 local/upstream notes/tag/asset/link outputs 做 ID/visibility/metadata 差异测试；
2. 把公开可直接消费的上游字段集中到一个 adapter，而不是分散在 merge/copy scripts；
3. local-only derived fields 必须有明确 owner 和测试；
4. 删除能够由 upstream authority 等价替代的手写 frontmatter parse path；
5. `pnpm sync` 最终不再需要“错误解析后再补字段”的补丁链。

**Acceptance**：private boundary 无回退；现有公开 routes/build 数量变化必须有可解释 diff；
`build-indexes.ts` 的 parser ownership 显著缩小或删除，且 parity test 固化原因。

**当前实施证据（同一份 3583 个同步 Markdown 做 scanner-only / reconciled A/B）：**

- route `id`：0 变化；`filePath`：0 变化；visibility：0 变化；日期：0 变化；
- public knowledge count：3460 → 3460；6 个 subscription 仍全部由 Digital Biome 判为 private；
- Thought Forest full-YAML metadata 修正：3452 个 `status`、3493 个 `type`、2 个 title、3 个 aliases、
  7 个 description；
- Digital Biome 不同步 Thought Forest `docs/*` 到公开内容；blogs 继续是 Digital Biome 自有发布源；
- 新增 authority contract，要求所有可映射条目的 title/description/tags/aliases/type/status 与上游
  full-YAML projection 一致，同时禁止 local public 比上游 visibility 更宽。
- `sync:content` 在真实同步结束后清理生成态 `.astro/`，防止大量 Markdown 替换后旧 content-loader cache
  产生瞬时 duplicate-id 误报；清理后 `astro check` 153 files / 0 error / 0 warning / 0 hint。

本次没有直接删除 local scanner：它仍负责 route/filePath、ISO date normalization、site-only fields、
blogs，以及更严格的 asset publication policy。后续只有在这些 owner 都有替代契约后才继续缩减。

### Batch C — Remaining payload boundary

#### DB-P2-201 — Tools catalog boundary

目标结构：

```text
build-time public bookmarks
       |
       +--> bounded initial cards --> /tools HTML
       |
       +--> public catalog JSON --> lazy fetch for search/category/more
```

**Acceptance**：

- 初始 HTML 保留真实可访问 bookmarks，不变成空 JS shell；
- 完整 155-item catalog 不内联；
- search/category URL state 与 keyboard navigation 保持；
- public/private filtering 复用现有 bookmark repository authority；
- `/tools` raw HTML 从 634 KiB 降到目标 **< 300 KiB**，gzip **< 30 KiB**；
- catalog 有 schema validation、single-flight/retry 与 performance budget。

### Batch D — Browser acceptance

#### DB-P2-301 — Focused Playwright E2E

只覆盖高风险交互，不做大而脆的截图套件：

- Notes SSR 12 → load-more；
- Notes `q` / `tag` URL 初始化与 clear/retry；
- SiteSearch Pagefind result；
- Discover fallback/classification；
- Tools query/category/lazy catalog（依赖 DB-P2-201）。

CI 使用 production build + local preview，Chromium 单浏览器即可。失败保留 trace，不默认录制视频。

## 5. 明确不做

- 不因为 `InfrastructureShowcase.astro` / `BiomeTree.astro` / `BookmarkGrid.astro` 行数大就机械拆文件；
  只有 Batch C/E2E 产生清晰 owner 后再拆。
- 不对 `/about/tags` 做虚拟化，仅因为 raw HTML 大；它是完整目录且 gzip 成本低。
- 不在 Phase 2 同时做全仓格式化。若引入 formatter/linter，先以 no-rewrite/check-only 方式证明收益。
- 不把 private/internal Thought Forest fields 直接复制到公开 JSON。

## 6. 最终验收与版本

Phase 2 收口时必须同时满足：

- `pnpm verify:full` 全绿；
- focused Chromium E2E 全绿；
- performance budget 与 private leak scan 全绿；
- Phase 2 before/after metrics 写入 `CHANGELOG.md`；
- 所有被迁移/取代的旧 PR、branch、worktree 清理；
- exact-main Cloudflare production build/deploy/smoke 成功；
- 由该 exact main 创建 `v0.2.0`，不在 tag 后继续塞“Phase 2 顺手修复”。
