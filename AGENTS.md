# digital-biome Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-01

## Active Technologies

- TypeScript 5.9.x + Astro 5.x, Cloudflare Pages + Pages Functions
- Tailwind CSS v4 (via `@tailwindcss/vite`, CSS-first config, no `tailwind.config.*`)
- Lucide Icons (via `@lucide/astro`)

## Project Structure

```text
src/
├── components/          # Astro components
│   ├── assets/          # Infrastructure and asset views
│   ├── common/          # Header, footer, search, and shared UI
│   ├── dashboard/       # Dashboard components
│   └── notes/           # Notes navigation and reading views
├── data/                # Generated public projection and indexes (gitignored)
├── domain/              # Routing and visibility rules
├── layouts/             # Base, dashboard, and notes layouts
├── pages/               # Static Astro routes
├── repositories/        # Content, asset, and index access
├── styles/              # Global CSS and design tokens
├── types/               # Shared content and asset types
├── utils/               # Sync, date, infrastructure, and Markdown helpers
└── view-models/         # Browser and page presentation models

functions/               # Cloudflare Pages Functions
scripts/                 # Sync, data-product, validation, and build tooling
data-products/           # Immutable producer projection locks
```

## Commands & Development Specifications

- **开发指令优先**：开发时优先使用 `pnpm dev:only` 进行开发测试，避免触发不必要的全量笔记同步。
- **代码诊断优先使用 astro check**：开发过程中，优先使用 `pnpm check` 进行 Astro、内容和 TypeScript 诊断。
- **可复用验证门禁**：`pnpm verify` 运行检查与测试；`pnpm verify:full` 额外运行生产构建、Pagefind、泄漏扫描和性能预算。
- **提交前运行完整门禁**：CI/Candidate 路径先用 `scripts/data-products/prepare-knowledge-public-v1.sh` 验证并物化 committed lock，再运行 `pnpm verify:full`；`pnpm sync` 现在同样从 committed lock 拉取并验证 public projection；本地确需读取私有 Thought Forest 时通过 `NOTES_VAULT_ROOT` / `NOTES_UPSTREAM_GENERATED` 显式选择外部 checkout。仅需构建已物化内容时使用 `pnpm build:only`。

## Context Workflow

- Use Repomix for resume writing, project summaries, architecture snapshots, and portfolio copy.
- Do not pack the full Obsidian vault by default; it is mostly content and can drown out the Astro application structure.
- Use CodeGraph only when changing Astro/TypeScript implementation code and symbol or dependency lookup is useful.
- For day-to-day content work, inspect the relevant Markdown note directly instead of indexing the whole vault.

## Code Style & Conventions

### 通用
- TypeScript 5.9.x，遵循标准规范
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
- 子 layout（DashboardLayout、NotesLayout）嵌套 BaseLayout
- BaseLayout 支持 props: `title`, `description?`, `image?`, `type?`, `bodyClass?`, `showHeader?`, `showFooter?`

### 标签系统
- 笔记使用层级标签，格式: `维度/子分类/...`（如 `tech/lang/typescript`）
- 常见维度: `status/`, `tech/`, `type/`, `life/`, `website/`
- 标签显示时取叶子节点名称，hover 显示完整路径

## Recent Changes

- 站点部署已对齐 Cloudflare Pages + Pages Functions，私有接口由 Cloudflare Access 保护
- Tailwind CSS v4 集成，global.css 添加 @import "tailwindcss"
- Lucide Icons (@lucide/astro) 集成
- Layout 架构优化：BaseLayout 作为唯一 HTML 壳，DashboardLayout 嵌套 BaseLayout
- 笔记列表首屏只渲染 12 条，完整 catalog 延迟加载；About 标签墙使用有界代表性标签
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

Production 不依赖仓库 gitlink；它按 Release manifest 的 source revision 临时检出私有
Thought Forest，只用于重建受保护 deployment payload，然后部署既有 immutable Pages artifact。
<!-- MANUAL ADDITIONS END -->
