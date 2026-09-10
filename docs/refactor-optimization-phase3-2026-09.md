# Digital Biome 系统性工程与性能优化 — Phase 3（2026-09）

> 状态：实施中
>
> 稳定基线：`v0.2.0` / `b04e50b`
>
> 下一版本目标：`v0.3.0`

## 1. Phase 3 目标

Phase 1/2 已经完成 Notes、Tools 数据边界、索引 authority、真实 Chromium E2E 与生产发布闭环。
Phase 3 不继续机械拆大组件，而从 `v0.2.0` production artifact 重新找“页面仍完整但重复标记或无用
产物显著膨胀”的成本。

本轮原则：

1. 优先减少浏览器实际 parse/DOM 工作，而不以删除 SSR 内容换数字；
2. 完整目录型页面优先做 markup density 优化，不先引入 catalog/lazy JS；
3. 任何 artifact pruning 必须用真实 Pagefind/Chromium 路径证明不会删掉运行时依赖；
4. Phase 3 的新预算基于同内容 A/B production build，不沿用旧数据猜目标。

## 2. v0.2.0 审计

### P1 — About tag directory 重复 SVG/utility markup

`/about/tags` 在 v0.2.0 production artifact 为 666,898 B raw（651.27 KiB），包含 700 个真实 tag link，
但同时渲染了 703 个 SVG。700 个标签节点各自重复 Lucide Tag SVG、186 字符 link utility class 和
112 字符 count utility class；数据本身并不需要这么大的 HTML。

### P1 — GitHub contribution heatmap 重复 tooltip DOM

`/about` 为 366,745 B raw（358.15 KiB）。371 个 contribution day 每个都渲染 outer wrapper、cell、
tooltip container 与两个 tooltip spans，导致页面总 DOM 2660 个元素。tooltip 文本本身已存在于 committed
snapshot，不需要每格一棵 tooltip 子树。

### P2 — Pagefind 生成了自定义搜索未使用的 UI artifacts

当前 custom typed Pagefind adapter 直接加载 `/pagefind/pagefind.js`；production output 仍包含
`pagefind-ui.js/css`、`pagefind-modular-ui.js/css`、`pagefind-highlight.js`。这些文件不等于可以直接删除；
Phase 3 需要先做引用扫描，并在 pruning 后跑真实 SiteSearch/Discover Chromium E2E 才能收敛。

## 3. Batch A — SSR markup density

### DB-P3-101 — Compact full tag directory

- 完整 tag directory 继续 SSR，不做虚拟化、不要求 JS；
- 每个 tag 只保留真实 `<a>` 与 count text，不重复 Lucide SVG；
- repeated Tailwind utility strings 收敛成 component-scoped `.tag-chip` 样式；
- build gate 要求 SSR tag link 数与 `data-tag-count` 一致，且禁止 `lucide-tag` 回流。

### DB-P3-102 — Compact contribution heatmap

- 每天只保留一个 `.contribution-cell` SSR node；
- level/date/tooltip 通过 data attributes 表达；
- hover tooltip 由 CSS `::after` 投影，不生成 per-day child subtree；
- heatmap 保留单一 `role="img"` + localized accessible summary owner；
- committed contribution day 数必须与 compact cell 数一致。

### 当前同内容 A/B

| Artifact | v0.2.0 | Phase 3 | Change |
|---|---:|---:|---:|
| `/about` raw HTML | 358.15 KiB | 147.40 KiB | -58.8% |
| `/about` gzip HTML | 20.76 KiB | 18.75 KiB | -9.6% |
| `/about` DOM elements | 2660 | 1176 | -55.8% |
| `/about/tags` raw HTML | 651.27 KiB | 125.13 KiB | -80.8% |
| `/about/tags` gzip HTML | 15.80 KiB | 12.31 KiB | -22.1% |
| `/about/tags` DOM elements | 4277 | 1478 | -65.4% |
| `/about/tags` SVG elements | 703 | 3 | -99.6% |

新预算：`/about` 200/32 KiB raw/gzip，`/about/tags` 220/24 KiB。预算保留内容增长空间，但会阻止
per-item SVG/tooltip 结构重新进入页面。

## 4. Batch B — Generated search artifact hygiene

### DB-P3-201 — Pagefind runtime surface

1. 证明 custom adapter / rendered HTML 不引用 Pagefind default UI/modular UI；
2. 识别 `pagefind.js` 搜索 runtime 的真实依赖集合；
3. 只删除确认无 owner 的 generated UI/highlight artifacts；
4. pruning 后必须通过 SiteSearch real Pagefind 与 Discover E2E；
5. 将 total dist JS/CSS budget 改成对“实际保留 runtime surface”有意义的预算。

## 5. 暂不做

- 不因为 `BiomeTree.astro`、`InfrastructureShowcase.astro` 文件长就机械拆分；
- 不把 `/about/tags` 改成 JS-only catalog；
- 不为了降低 total JS 数字删除 Pagefind 运行时真正会动态加载的文件；
- 不在 markup batch 顺手改视觉设计系统。
