# Digital Biome 系统性工程与性能优化计划（2026-09）

> 状态：实施前基线 / ForgeFlow real-project acceptance candidate
>
> 基线主仓库：`7a49535`
>
> 目标：在不改变 Digital Biome 核心产品语义、私有数据边界和发布模型的前提下，优先解决已经能被量化证明的前端数据边界、DOM 规模、浏览器代码重复与工程门禁问题，并把性能退化变成 CI 可检测的失败。

## 1. 本轮原则

本轮不是“大文件拆小文件”式整理，也不是为了统一形式重写整个 Astro 应用。优化优先级按以下顺序判断：

1. **用户可感知成本**：首屏传输、HTML 解析、DOM 数量、运行时加载；
2. **工程事实源**：重复实现、浏览器/构建边界、类型权威；
3. **可验证性**：PR 阶段能否自动发现 build / performance / contract regression；
4. **变更半径**：优先局部可逆改造，不在一次任务里跨越 Thought Forest 私有上游契约；
5. **产品语义保持**：笔记过滤、标签入口、Pagefind 搜索、私有数据泄漏门禁和 Cloudflare 发布流程必须保持。

## 2. 审计方法与基线

审计覆盖：

- `src/pages`、`src/components`、`src/layouts`、`src/domain`、`src/repositories`、`src/view-models`；
- `scripts`、`edge`、`functions`；
- `package.json`、Astro/TypeScript 配置、GitHub Actions；
- 当前架构/开发/Agent 文档；
- `pnpm check`、edge/unit/infrastructure tests、`pnpm build:only`；
- 构建后 HTML/JS/CSS/静态资产体积与关键页面 DOM 粗指标。

### 2.1 确定性基线

| Gate | 结果 | 时间 | 峰值 RSS |
|---|---:|---:|---:|
| `pnpm check` | 0 errors / 19 hints | 11.27 s | ~1.85 GiB |
| `pnpm check:edge` | PASS | 1.13 s | ~165 MiB |
| `pnpm test:edge` | 19/19 | 1.13 s | ~165 MiB |
| `pnpm test:unit` | 12/12 | 1.04 s | ~165 MiB |
| `pnpm test:infrastructure` | 3/3 | 1.03 s | ~165 MiB |
| `pnpm build:only` | PASS | 37.03 s | ~2.84 GiB |

构建公开笔记：3489 篇；`dist/` 总量约 245 MiB。编译后的业务 JavaScript 仅约 187.9 KiB、CSS 约 176.2 KiB，说明当前最明显的页面成本并非框架 JS bundle，而是**数据/DOM 被直接写进静态 HTML**。

### 2.2 关键页面体积

| 页面 | raw HTML | gzip 估算 | 主要原因 |
|---|---:|---:|---|
| `/` | 46.5 KiB | 9.9 KiB | 正常 |
| `/notes` | **1089.4 KiB** | **286.6 KiB** | 3489 条 NoteCard 数据通过 `define:vars` 全量内联 |
| `/about` | **779.5 KiB** | 31.4 KiB | 全量 Tag Wall 两份 marquee DOM |
| `/about/tags` | 630.9 KiB | 15.4 KiB | 完整标签目录（信息型页面，可接受但应持续观察） |
| `/tools` | 540.3 KiB | 29.9 KiB | 完整 BookmarkGrid（后续优化候选） |
| `/discover` | 29.3 KiB | 8.9 KiB | 正常 |

`/notes/index.html` 中 inline script 约 845 KiB；这比全站编译后的业务 JS 总量大约 4.5 倍。

## 3. 主要发现

### P1 — Notes 页面把完整知识库列表当成首屏脚本数据

当前 `src/pages/notes/index.astro`：

1. 构建时读取全部公开笔记；
2. 将每篇笔记的 id/title/description/tags/date/timestamp 组成 `notesData`；
3. 使用 `<script define:vars={{ notesData, ... }}>` 把 3489 条数据直接注入 HTML；
4. 首屏列表本身却完全由客户端脚本再渲染，每次仅显示 12 条。

后果：

- 首屏为“未来可能滚动/搜索到的数据”支付全部传输与 HTML parser 成本；
- `define:vars` 让该脚本退化为 inline，Astro/Vite 无法正常做 TypeScript/module processing；
- 搜索、标签过滤和卡片 DOM 构造全部挤在一个 300+ 行页面里；
- `Astro.url.searchParams` 对静态输出并不是可靠的请求时 query authority；客户端应以 `window.location.search` 为运行时 URL 状态；
- `/about/tags` 链接使用 `?tag=...`，而现有 notes 脚本没有消费初始 `tag` 参数，属于导航语义缺口。

**目标架构：**

```text
build-time public notes
       |
       +--> first N cards --> static /notes HTML
       |
       +--> compact public catalog --> /data/notes-catalog.json
                                      |
                              lazy browser fetch
                         (search / tag / load-more)
```

要求：

- 首屏 SSR 12 条，完整 catalog 不进入首屏 HTML；
- catalog 仍只包含已经通过 public-note filtering 的字段；
- catalog 由 Astro build 生成，不新增第二个手工数据源；
- 浏览器 catalog fetch single-flight/cached；
- `q` / `tag` 从运行时 URL 初始化；
- 客户端动态内容优先 `textContent`/DOM API，不把笔记字段直接拼入 `innerHTML`；
- 保持当前 newest-first、query、AND tag filters、infinite-load 行为。

### P1 — About Tag Wall 将完整标签目录复制成动画 DOM

公开 tag index 当前约 698 个标签；排除 `status/*` / `type/*` 后，About 背景仍使用约 680 个标签。`ScrollingTagWall` 为无缝 marquee 把每个 lane 再复制一次：

- `/about`: 约 1368 个 `<a>`、4901 个 `<span>`；
- raw HTML 779.5 KiB；
- 第二份 marquee copy 只是视觉循环副本，却仍保持可聚焦链接语义。

**目标：** Tag Wall 只是 Hero 的代表性背景，不承担“完整标签目录”职责；完整目录继续由 `/about/tags` 承担。

要求：

- 选取按引用数排序后的固定上限代表性标签（目标 80–96）；
- 视觉复制副本 `aria-hidden` 且不可进入 tab sequence；
- 支持 `prefers-reduced-motion`；
- 保持 8 lane 视觉与现有 Basalt & Moss 风格；
- `/about/tags` 不删数据、不截断。

### P1 — SiteSearch 与 Discover 重复维护 Pagefind runtime

`SiteSearch.astro` 与 `pages/discover/index.astro` 各自实现：

- lazy dynamic import `/pagefind/pagefind.js`；
- init/catch/dev-mode fallback；
- Pagefind result data hydration；
- 大量 `any` 类型。

两者连 import 技巧都不同：一处使用 `new Function(...import...)`，另一处直接 dynamic import。随着 Pagefind 升级或 dev fallback 变化，两条路径容易漂移。

**目标：** 建立一个窄的 browser-only Pagefind adapter，负责 loader、类型和结果 hydration；两个 feature 继续各自拥有搜索 UX/结果映射，不制造“大而全 SearchService”。

同时移除 `/discover` 对 `define:vars` 的依赖：小型 asset seed 可以通过受控 JSON data island 进入页面，query/scope 从浏览器 URL 读取，让交互脚本恢复正常 TS/Vite processing。

### P2 — 工程 gate 没有覆盖 PR build/performance regression

当前 `check.yml` 会执行 sync、Astro/edge check 与测试，但不执行 production static build。结果是：

- PR 可以全部 green；
- 合并 main 后生产 workflow 才第一次发现 Astro build/Pagefind/postbuild regression；
- 页面体积增长没有机器门禁。

**目标：** 建立一条可在本地和 CI 复用的确定性验证契约，例如：

```text
pnpm verify
  -> astro check
  -> edge typecheck
  -> unit/edge/infrastructure tests

pnpm verify:full
  -> verify
  -> build:only
       -> astro build
       -> pagefind
       -> leak scan
       -> performance budget
```

PR CI 在锁定 vault SHA 完成 `pnpm sync` 后执行 `verify:full`。

### P2 — 代码/文档卫生有可直接消除的漂移

当前 `astro check` 有 19 个 hints，主要包括：

- 未使用变量/import；
- Lucide `Github` deprecated icon；
- Notes/Discover `define:vars` 造成 inline-script hint。

`AGENTS.md` 也存在明显过时信息：

- 仍写 `@astrojs/netlify`，实际部署为 Cloudflare Pages；
- 仍写旧 `src/content/notes/obsidian` 输出路径；
- 目录树包含已不存在的 resume 等旧结构；
- Recent Changes 仍停在早期项目初始化状态。

本轮应清掉“碰得到、可证明”的卫生问题，并将 AGENTS 对齐当前真实架构和验证命令。

## 4. 不在第一轮做的事项

### 4.1 双 frontmatter parser

`docs/architecture.md` 已记录本地轻量扫描与 Thought Forest 上游完整 YAML 解析并存。它是重要的 P1 架构债务，但修复会跨越私有上游仓库、同步索引 schema 与发布输入契约。本轮只保留问题，不在前端性能重构中顺手迁移。

### 4.2 机械拆分 600 行 Astro 组件

`InfrastructureShowcase`、`BiomeTree`、`BookmarkGrid` 体积大，但“行数大”本身不是用户性能证据。只有当某个 feature 在本轮变更中出现明确 owner/测试边界时才拆分；不为了目录美观制造无收益搬运。

### 4.3 全仓 formatter/linter 大清洗

当前缺少 ESLint/Prettier/Biome 的统一契约，但一次引入并全仓格式化会制造巨大无语义 diff。先用现有 TypeScript/Astro gate、focused tests 和性能预算建立稳定基线；lint/format 可作为后续独立工程 PR。

### 4.4 `/about/tags` 与 `/tools` 全量目录虚拟化

它们的 raw HTML 较大，但属于用户明确进入的“完整目录”页面，gzip 后体积明显较小。先处理 `/notes` 首屏和纯装饰 Tag Wall；后续基于真实访问/交互数据决定是否分页、分组或 client virtualization。

## 5. 实施图

### Batch A — 可并行的高收益切片

#### DB-OPT-101 — Notes list data boundary

**Write scope**

- `src/pages/notes/**`
- 新增 `src/pages/data/notes-catalog.json.ts`
- 新增/调整 `src/view-models/*note*`
- 新增/调整 `src/browser/*note*`
- focused tests for note-card/catalog/filter helpers

**Acceptance**

- `/notes` 首屏不再包含完整 notes catalog；
- 首屏静态渲染至少 12 条真实公开笔记；
- 完整 catalog 只在 search/tag/load-more 时 lazy load；
- `?q=` 与 `?tag=` 可在静态站真实 URL 上工作；
- query + multi-tag filter 语义保持；
- `astro check` 不再报告 notes `define:vars` inline hint；
- build 后 `/notes/index.html` raw 目标 **< 200 KiB**，gzip 目标 **< 60 KiB**；
- public/private filtering 与 postbuild leak gate 保持。

#### DB-OPT-102 — Bounded accessible Tag Wall

**Write scope**

- `src/components/common/ScrollingTagWall.astro`
- `src/pages/about/index.astro`
- focused markup/data helper tests if introduced

**Acceptance**

- Hero background最多使用 96 个代表性标签；
- duplicate marquee copy 不可聚焦并对辅助技术隐藏；
- reduced-motion 下不持续动画；
- `/about/tags` 仍完整；
- `/about/index.html` raw 目标 **< 360 KiB**；
- 视觉仍保持 8 lane marquee。

#### DB-OPT-103 — Shared typed Pagefind browser adapter

**Write scope**

- 新增 `src/browser/pagefind*`
- `src/components/common/SiteSearch.astro`
- `src/pages/discover/index.astro`
- focused unit tests for adapter/result normalization

**Acceptance**

- Pagefind import/init/failure cache 只有一个 owner；
- SiteSearch/Discover 不再各自维护 loader；
- touched browser code 不使用 `any` 表达 Pagefind result；
- Discover 不再依赖 `define:vars` inline script；
- dev-mode fallback 与 production Pagefind 搜索保持；
- query/scope 从运行时 URL 初始化并继续更新 URL。

### Batch B — 统一工程门禁（依赖 Batch A）

#### DB-OPT-104 — Quality, CI and performance fitness functions

**Write scope**

- `package.json` / `pnpm-lock.yaml`
- `.github/workflows/check.yml`
- `scripts/check-performance-budgets.ts`
- 本轮触及文件附近的显式 Astro hints
- `AGENTS.md`
- 本文与必要的架构/开发文档

**Acceptance**

- 增加可复用 `verify` / `verify:full`；
- PR CI 在 merge 前完成 build + Pagefind + leak scan + performance budgets；
- performance budget 至少覆盖 `/notes` 与 `/about`，且阈值基于本轮实际结果留合理增长空间；
- 删除本轮审计发现的明确 unused/deprecated hints；
- Notes/Discover inline-script hints 已由架构改造消失；
- `AGENTS.md` 不再声称 Netlify/旧 content path/旧目录结构；
- full local gate 与 GitHub CI 均通过。

## 6. 验收与性能对比

实施完成后必须记录同一套数据：

- `pnpm verify:full` 结果；
- server-side/edge/unit/infrastructure test counts；
- `pnpm check` diagnostics；
- build elapsed/max RSS；
- `/notes`、`/about`、`/discover`、`/tools` raw + gzip HTML；
- dist JS/CSS 总量；
- Notes catalog JSON 体积与其是否延迟加载；
- 浏览器功能：Notes initial list、load more、q、tag、Pagefind SiteSearch、Discover fallback；
- ForgeFlow exact implementation/review revisions、provider cleanup、worktree retirement、project lease release。

### 6.1 DB-OPT-104 integrated evidence

在集成 `f5538e3`、`00e6f91`、`12ba850` 后，2026-09-09 的本地完整门禁结果如下。尺寸均来自同一次 production build；KiB 按 1024 字节计算。下表的 Pagefind 数字是该本地 run 的结果，不代表 GitHub Actions 的独立 run。

| 项目 | 结果 |
|---|---|
| `pnpm verify:full` | PASS；端到端耗时 2:03.43，峰值 RSS 约 2.66 GiB |
| server-side/static build | 3512 个页面；无独立 server test suite |
| `pnpm test:edge` | 19/19 |
| `pnpm test:unit` | 21/21，包含 `src/browser/pagefind.test.ts` 的 5 个 Pagefind adapter tests |
| `pnpm test:infrastructure` | 3/3 |
| `pnpm check` | 127 files；0 errors / 0 warnings / 0 hints |
| Astro build | PASS；41.70 s，峰值 RSS 约 2.88 GiB |
| Pagefind | PASS；本地 override run：3512 pages、45220 words；30.397 s |
| leak scan | PASS；检查 130 个敏感值 |

GitHub Actions 的独立 `check` run 对 exact commit `052e950139c246ce1b044744e23f80df43fcc7ee` 记录为 3512 pages、45219 words；这与上述本地 override run 的 45220 words 保留为两个有明确 provenance 的测量，不做数值抹平。

| 页面 | raw HTML | gzip HTML | budget (raw / gzip) |
|---|---:|---:|---:|
| `/notes` | 47.2 KiB | 9.2 KiB | 200 / 60 KiB |
| `/about` | 355.1 KiB | 21.1 KiB | 400 / 50 KiB |
| `/discover` | 23.7 KiB | 7.4 KiB | 64 / 20 KiB |
| `/tools` | 633.8 KiB | 34.7 KiB | 700 / 48 KiB |

构建产物中的 JavaScript 总量为 198.3 KiB，CSS 总量为 175.9 KiB。`/data/notes-catalog.json` 为 1260.7 KiB；它由 Astro build 生成，不出现在 `/notes/index.html`，仅在搜索、标签筛选或继续加载时由浏览器请求并缓存。首屏静态 HTML 保留 12 条真实公开笔记。

Notes 的首屏、lazy catalog/filter contract（包括 extracted deferred loader orchestration）、Pagefind adapter normalization/cache、Discover 的 asset fallback 由 focused tests 与静态产物检查覆盖；真实浏览器交互仍应在部署预览中做一次冒烟验证。当前 sandbox 未安装 Git LFS，因此本地门禁使用同 SHA 的已填充 Thought Forest checkout 配合 `NOTES_VAULT_ROOT` / `NOTES_UPSTREAM_GENERATED` 覆盖；CI 仍通过 pinned submodule 的标准 `pnpm sync` 执行。

### 6.2 R2 gate-hardening evidence

R2 的本地 final run 使用以下同 SHA vault override：

```bash
NO_COLOR=1 \
NOTES_VAULT_ROOT=/home/dev/projects/digital-biome/thought-forest \
NOTES_UPSTREAM_GENERATED=/home/dev/projects/digital-biome/thought-forest/generated \
pnpm verify:full
```

结果为 PASS：`pnpm check` 为 137 files、0 errors / 0 warnings / 0 hints；edge 19/19、unit 33/33、infrastructure 6/6。`pnpm check:performance` 也为 PASS：`/notes` 47.8 KiB raw / 9.4 KiB gzip、catalog 1260.7 KiB、12 条 SSR cards，dist JavaScript 201.0 KiB、CSS 176.3 KiB。该静态门禁按生成 HTML 中的 card IDs 对照 catalog 前 12 项，并拒绝 deferred IDs、catalog filename 和 catalog data island；浏览器 DOM/IntersectionObserver 的真实交互仍未在本地 preview 中执行。

在这次 build 生成的 `dist` 上，随后单独执行的 Pagefind v1.4.0 local run 记录为 3512 pages、45220 words、29.887 s。该数字只代表此 local run；GitHub Actions 对 exact commit `052e950139c246ce1b044744e23f80df43fcc7ee` 的独立记录仍是 45219 words，二者不视为同一次测量。

## 7. ForgeFlow real-project acceptance

本计划刻意适合作为 ForgeFlow v1.4.0 的真实项目验证：

```text
Digital Biome main + 本文
        |
        v
one root Plan
  |
  +-- Batch A / DB-OPT-101 Notes boundary
  +-- Batch A / DB-OPT-102 Tag Wall
  +-- Batch A / DB-OPT-103 Pagefind adapter
        |
        v
  independent exact-SHA review
        |
        v
  Batch B / DB-OPT-104 gates + docs
        |
        v
  exact-SHA review -> integration -> CI -> cleanup
```

成功条件不是“代码看起来更整洁”，而是：

1. 有可重复的 before/after 指标；
2. 每个切片有独立 implementation + review evidence；
3. 最终 main/PR gate 全绿；
4. 没有为了性能破坏 private-data boundary；
5. ForgeFlow 自动完成 provider cleanup、worktree retirement 与 lease release。
