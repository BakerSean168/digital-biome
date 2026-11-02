# digital-biome Development Guidelines

Maintained by hand against `main`; last reconciled 2026-11-02 (DB-Q16). `scripts/docs-topology-contract.test.ts`
fails CI when the stack versions, layouts or route map below drift from the code.

## Active Technologies

- Astro 7 + TypeScript 6 (strict, `astro/tsconfigs/strict`); Node 24 / pnpm 10
- Cloudflare Pages (static `dist/`) + Pages Functions (`functions/`, only `/api/private/*`)
- Tailwind CSS 4 (via `@tailwindcss/vite`, CSS-first config, no `tailwind.config.*`)
- Lucide Icons (via `@lucide/astro`)
- Quality tooling: Biome lint + Oxlint (`lint:astro` covers Astro client scripts), Oxfmt with a format ratchet
- Pinned public data products: `knowledge-public-v1`, `infra-public-v2`, `pds-catalog-v1` (locks in `data-products/`)

## Project Structure

```text
src/
├── components/          # Astro components
│   ├── assets/          # Infrastructure and asset views
│   ├── common/          # Header, search, GUI home, private unlock, shared UI
│   ├── notes/           # Notes navigation and reading views
│   └── terminal/        # ObjectBrowser / LibraryTabs (TUI catalog views)
├── browser/             # Client controllers (search, terminal browser, owner systems)
├── data/                # Generated public projection and indexes (gitignored)
├── domain/              # Routing and visibility rules
├── layouts/             # BaseLayout, TerminalLayout, NotesLayout
├── pages/               # Static Astro routes
├── repositories/        # Content, asset, and index access
├── styles/              # Global CSS and design tokens
├── types/               # Shared content and asset types
├── utils/               # Sync, date, infrastructure, and Markdown helpers
└── view-models/         # Browser and page presentation models

functions/               # Cloudflare Pages Functions
edge/                    # Shared edge/Access helpers used by Pages Functions
scripts/                 # Sync, data-product, validation, and build tooling
├── data-products/       # Lock fetch/verify/materialize + `preflight.ts`
└── delivery/            # Candidate/Release manifest: `manifest-schema.ts` (v5 current, v3/v4 rollback),
                         # `manifest-validate.ts`, `manifest-create.ts`, `manifest.ts` (CLI only)
data-products/           # Immutable producer projection locks
```

### Route map

当前公开路由、布局与交付模块以 [`docs/architecture.md` §3.0](docs/architecture.md#30-应用拓扑main-现状) 为准。
Retired and guarded by tests: Dashboard/BiomeTree UI and `DashboardLayout`, Observability, `/discover`, `/about/refactor`.
This file and `docs/architecture.md` are the current design record.

## Commands & Development Specifications

- **开发指令优先**：开发时优先使用 `pnpm dev:only` 进行开发测试，避免触发不必要的全量笔记同步。
- **代码诊断优先使用 astro check**：开发过程中，优先使用 `pnpm check` 进行 Astro、内容和 TypeScript 诊断。
- **可复用验证门禁**：`pnpm verify` 先运行只读离线的 `pnpm preflight:data-products`（逐项对照三份 committed lock 的 SHA-256 并跑完整 publication 校验；缺失/过期缓存会指出具体 lock、文件与摘要，并提示 `pnpm sync:data-products`，绝不改 lock 或跳过校验），再运行检查与测试；`pnpm verify:full` 额外运行生产构建、Pagefind、泄漏扫描和性能预算。
- **提交前运行完整门禁**：CI/Candidate 路径先用 `pnpm sync:data-products` 验证并物化 knowledge、infra、PDS 三份 committed public lock，再运行 `pnpm verify:full`；`pnpm sync` 是同一入口，生成 ignored public projection（含 `src/data/system/pds-catalog-v1.json`），不检出 producer source 或运行 exporter；本地确需读取私有 Thought Forest 时通过 `NOTES_VAULT_ROOT` / `NOTES_UPSTREAM_GENERATED` 显式选择外部 checkout。仅需构建已物化内容时使用 `pnpm build:only`。

## Engineering Principles

- **静态优先**：页面默认输出静态 HTML；客户端交互放在 `src/browser/` 控制器中按页面初始化，不引入全局可变状态。
- **性能是门禁**：第三方脚本延迟加载；`pnpm verify:full` 的性能预算失败即为回归，放宽预算须在 PR 中说明理由。
- **简单优先（YAGNI）**：抽象须有具体调用方；不再使用的代码、资产与依赖及时删除，删除前确认无静态/动态引用。
- **测试与文档**：交互控制器和关键用户路径须有单元测试或 `e2e/` 覆盖；新增依赖、脚本或路由时同步更新 README / AGENTS / architecture。

## Context Workflow

- Use Repomix for resume writing, project summaries, architecture snapshots, and portfolio copy.
- Do not pack the full Obsidian vault by default; it is mostly content and can drown out the Astro application structure.
- Use CodeGraph only when changing Astro/TypeScript implementation code and symbol or dependency lookup is useful.
- For day-to-day content work, inspect the relevant Markdown note directly instead of indexing the whole vault.

## Code Style & Conventions

### 通用

- TypeScript 6（strict），遵循标准规范；TypeScript 7 暂缓：`astro check` / `@astrojs/check` 尚不支持（见 #187）
- 组件格式：`.astro` 文件

### 样式与设计语言 (Basalt & Moss)

- **核心风格**: 极客侘寂风 (Geek Wabi-Sabi)。严禁使用弥散阴影、大面积光晕和过大的圆角。
- **设计规范文件**: `docs/design-system-basalt-and-moss.md`。在新建任何组件前，必须参考此文档。
- **使用 Tailwind v4 utility classes**，不要写 scoped `<style>` 块。
- 项目已有 CSS 变量（Design Tokens），在 Tailwind 中映射为类名使用（如 `bg-background`、`text-foreground`、`text-muted-foreground`、`border-border`）：
  - 主色 (Moss): `--primary` 暗绿色体系 (用于极少数的高光点缀)
  - 背景 (Basalt): `--bg` 极度深灰 (映射为 `bg-background`，如 `#151614`)
  - 卡片背景: `--card` (映射为 `bg-card`)
  - 文字: `--text-main` 冷白高对比度 (映射为 `text-foreground`)
  - 次要文字: `--text-muted` (映射为 `text-muted-foreground`)
  - 边框: `--border-color` (映射为 `border-border`，大量用于 1px solid 边框)
- **UI 元素**:
  - 杜绝使用 `rounded-xl`、`rounded-2xl`，使用直角或 `rounded-sm`。
  - 强调终端视觉效果（Terminal-like），多用等宽字体 (`font-mono`) 配合大写和字距 (`tracking-widest`)，如按钮 `[ BUTTON_TEXT ]`。

### 图标

- **统一使用 `@lucide/astro`**，不要用 emoji 或内联 SVG
- 导入方式：`import { IconName } from '@lucide/astro'`
- 用法：`<IconName size={20} />`
- 图标列表参考：https://lucide.dev/icons/

### 布局

- 所有页面必须通过 `BaseLayout.astro` 渲染 `<html>` 壳
- 子 layout（TerminalLayout、NotesLayout）嵌套 BaseLayout；公共列表页使用 TerminalLayout + ObjectBrowser
- BaseLayout 支持 props: `title`, `description?`, `image?`, `type?`, `bodyClass?`, `showHeader?`

### 标签系统

- 笔记使用层级标签，格式: `维度/子分类/...`（如 `tech/lang/typescript`）
- 常见维度: `status/`, `tech/`, `type/`, `life/`, `website/`
- 标签显示时取叶子节点名称，hover 显示完整路径

## Recent Changes

- 站点部署已对齐 Cloudflare Pages + Pages Functions，私有接口由 Cloudflare Access 保护
- Tailwind CSS v4 集成，global.css 添加 @import "tailwindcss"
- Lucide Icons (@lucide/astro) 集成
- 2026-11 质量 EPIC #172：Astro 7.4、TypeScript 6.0、Tailwind 4.3；delivery manifest 拆分为 schema/validate/create/CLI；`pnpm verify` 前置 data-product preflight
- Layout 架构：BaseLayout 作为唯一 HTML 壳，TerminalLayout / NotesLayout 嵌套 BaseLayout；旧 Dashboard UI 已退役
- 笔记列表首屏只渲染 12 条，完整 catalog 延迟加载；About 滚动标签墙已随双界面改版退役，完整标签见 `/about/tags`
- SiteSearch 与 Discover 共用 typed Pagefind browser adapter
- `pnpm verify` / `pnpm verify:full` 覆盖诊断、测试、生产构建、泄漏扫描和性能预算

<!-- MANUAL ADDITIONS START -->

## 笔记数据源配置

`notes.config.ts` 默认读取 `.pds-runtime/knowledge-public-v1/source`。该目录由
`scripts/data-products/prepare-knowledge-public-v1.sh` 根据 committed lock 验证并物化；
不要把 producer source layout 重新编码成仓库内路径。

日常同步：

```bash
pnpm sync
```

如果 `GH_TOKEN` 未设置，脚本会尝试复用 `gh auth token`。CI 使用短期只读 GitHub App token。

本地确需直接联调私有 Thought Forest 时，使用外部 checkout，并显式选择：

```bash
NOTES_VAULT_ROOT=/path/to/thought-forest \
NOTES_UPSTREAM_GENERATED=/path/to/thought-forest/generated \
pnpm sync:content
```

Production 不依赖仓库 gitlink。当前 Release（manifest v5；v3/v4 仅保留为已发布 Release 的 rollback）将公开知识投影与私有基础设施绑定分开：
`knowledge-public-v1` 继续由 Thought Forest 发布；受保护 deployment payload 则按 Release manifest
固定的 Personal Infrastructure revision + SHA-256 读取 `digital-biome-private-infrastructure-v1`
RuntimeBinding，然后部署既有 immutable Pages artifact。v1/v2 delivery schema 已退休。
<!-- MANUAL ADDITIONS END -->
