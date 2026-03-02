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

## Commands

pnpm dev; pnpm build; pnpm sync

## Code Style & Conventions

### 通用
- TypeScript 5.9.x，遵循标准规范
- 组件格式：`.astro` 文件

### 样式
- **使用 Tailwind v4 utility classes**，不要写 scoped `<style>` 块（除非有 Tailwind 无法覆盖的特殊样式）
- Tailwind 入口在 `src/styles/global.css` 的 `@import "tailwindcss"`
- 项目已有 CSS 变量（Design Tokens），在 Tailwind 中通过 `var()` 引用：
  - 主色: `var(--color-primary)` #10B981
  - 背景: `var(--bg)` #F8FAFC (dark: #121212)
  - 文字: `var(--text-main)` #0F172A (dark: #E2E8F0)
  - 次要文字: `var(--text-muted)` #64748B (dark: #94A3B8)
  - 边框: `var(--border-color)` #E2E8F0 (dark: #333333)
  - 卡片背景: `var(--card)` #FFFFFF (dark: #1E1E1E)
  - 圆角: `--radius-sm` 4px / `--radius-md` 8px / `--radius-lg` 12px
- 暗色模式通过 `html.dark` class 切换（不用 Tailwind dark: 前缀）

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
