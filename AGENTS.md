# digital-biome Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-01

## Active Technologies

- TypeScript 5.9.x + Astro 5.x, @astrojs/netlify
- Tailwind CSS v4 (via `@tailwindcss/vite`, CSS-first config, no `tailwind.config.*`)
- Lucide Icons (via `@lucide/astro`)

## Project Structure

```text
src/
├── components/          # Astro 组件
│   ├── common/          # 公共组件（Header, Footer, ThemeIcon, SiteSearch）
│   ├── dashboard/       # 首页 Dashboard 组件
│   ├── resume/          # 个人简历组件
│   └── notes/           # 笔记组件（NotesSidebar, TableOfContents, Backlinks）
├── content/             # 内容集合（Astro Content Collections）
│   ├── notes/obsidian/  # Obsidian 同步笔记（.gitignored，由 pnpm sync 生成）
│   └── meta/            # 元数据（简历等）
├── layouts/             # 页面布局
│   ├── BaseLayout.astro # 唯一的 <html> 壳，所有 layout 必须嵌套它
│   ├── DashboardLayout.astro
│   └── NotesLayout.astro
├── pages/               # 页面路由
│   ├── index.astro      # Dashboard (/)
│   ├── about/           # 关于页 + 简历
│   └── notes/           # 笔记列表 + 详情
├── styles/
│   └── global.css       # 全局样式 + Tailwind 入口 + CSS 变量（Design Tokens）
└── utils/               # 工具函数 / Remark 插件
```

## Commands & Development Specifications

- **开发指令优先**：开发时优先使用 `pnpm dev:only` 进行开发测试，避免触发不必要的全量笔记同步与favicons处理。
- **不要在开发时使用 `pnpm build`**：开发过程中不要使用 `pnpm build`。因为这会触发耗时且不需要的笔记全量打包与处理。开发环境自带热更新，在 `dev:only` 模式下直接预览即可。
- **代码诊断优先使用 astro check**：开发过程中，优先使用 `pnpm astro check` 进行代码准确性和 TypeScript 类型诊断。
- **提交前运行 build:only 测试**：在提交代码前，必须使用 `pnpm build:only` 对纯前端逻辑进行构建测试，确保没有任何编译阻碍。

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

- 001-project-core: Added TypeScript 5.9.x + Astro 5.x, @astrojs/netlify
- Tailwind CSS v4 集成，global.css 添加 @import "tailwindcss"
- Lucide Icons (@lucide/astro) 集成
- Layout 架构优化：BaseLayout 作为唯一 HTML 壳，DashboardLayout 嵌套 BaseLayout
- 笔记系统重构：wiki -> notes，支持层级标签，修复同步脚本标签丢失问题

<!-- MANUAL ADDITIONS START -->
## 笔记仓库配置

在 `notes.config.ts` 中配置笔记仓库路径：

```ts
export const notesConfig = {
  vault: {
    path: 'thought-forest/z',  // Obsidian vault 路径（submodule）
    assets: 'thought-forest/assets',
    include: ['**/*.md'],
    exclude: ['**/.git/**', '**/node_modules/**', '**/.obsidian/**'],
  },
  output: {
    notes: 'src/content/notes/obsidian',  // 同步输出目录
    assets: 'public/vault-assets',
  },
};
```

### 使用步骤

1. 确保 Obsidian vault submodule 已初始化：
   ```bash
   git submodule update --init
   ```

2. 运行同步脚本：
   ```bash
   pnpm sync
   ```

3. 启动开发服务器：
   ```bash
   pnpm dev
   ```
<!-- MANUAL ADDITIONS END -->
