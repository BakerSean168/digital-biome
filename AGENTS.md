# digital-biome Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-22

## Active Technologies

- TypeScript 5.9.x + Astro 5.x, @astrojs/netlify
- Tailwind CSS v4 (via `@tailwindcss/vite`, CSS-first config, no `tailwind.config.*`)
- Lucide Icons (via `@lucide/astro`)

## Project Structure

```text
src/
├── components/          # Astro 组件
│   ├── common/          # 公共组件（Header, Footer, ThemeIcon）
│   ├── dashboard/       # 首页 Dashboard 组件
│   ├── resume/          # 个人简历组件
│   └── wiki/            # 笔记/Wiki 组件
├── content/             # 内容集合（Astro Content Collections）
├── layouts/             # 页面布局
│   ├── BaseLayout.astro # 唯一的 <html> 壳，所有 layout 必须嵌套它
│   ├── DashboardLayout.astro
│   └── NotesLayout.astro
├── pages/               # 页面路由
├── styles/
│   └── global.css       # 全局样式 + Tailwind 入口 + CSS 变量（Design Tokens）
└── utils/               # 工具函数 / Remark 插件
```

## Commands

pnpm dev; pnpm build; npm test; npm run lint

## Code Style & Conventions

### 通用
- TypeScript 5.9.x，遵循标准规范
- 组件格式：`.astro` 文件

### 样式
- **使用 Tailwind v4 utility classes**，不要写 scoped `<style>` 块（除非有 Tailwind 无法覆盖的特殊样式）
- Tailwind 入口在 `src/styles/global.css` 的 `@import "tailwindcss"`
- 项目已有 CSS 变量（Design Tokens），在 Tailwind 中通过 `var()` 引用：
  - 主色: `var(--color-primary)` #0066cc
  - 背景: `var(--color-bg)` #ffffff (dark: #1a1a2e)
  - 文字: `var(--color-text)` #1a1a1a (dark: #e8e8e8)
  - 次要文字: `var(--color-text-secondary)` #666 (dark: #aaa)
  - 边框: `var(--color-border)` #e5e5e5 (dark: #2d2d4a)
  - 卡片背景: `var(--color-card-bg)` #ffffff (dark: #1e1e3f)
  - 标签背景: `var(--color-tag-bg)` #f0f0f0 (dark: #2d2d4a)
  - 圆角: `var(--border-radius-sm)` 4px / `var(--border-radius-md)` 8px / `var(--border-radius-lg)` 12px
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

## Recent Changes

- 001-project-core: Added TypeScript 5.9.x + Astro 5.x, @astrojs/netlify
- Tailwind CSS v4 集成，global.css 添加 @import "tailwindcss"
- Lucide Icons (@lucide/astro) 集成
- Layout 架构优化：BaseLayout 作为唯一 HTML 壳，DashboardLayout 嵌套 BaseLayout

<!-- MANUAL ADDITIONS START -->
## 笔记仓库配置

在 `notes.config.ts` 中配置笔记仓库路径：

```ts
export const notesConfig = {
  vault: {
    path: 'vault/z',  // 你的笔记仓库路径（支持 submodule 或本地目录）
    include: ['**/*.md'],
    exclude: ['**/.git/**', '**/node_modules/**', '**/.obsidian/**'],
  },
  output: {
    wiki: 'src/content/wiki/obsidian',  // 同步输出目录
  },
};
```

### 使用步骤

1. 添加笔记仓库为 submodule（或直接放置到配置的路径）：
   ```bash
   git submodule add <你的笔记仓库URL> vault/z
   ```

2. 运行同步脚本：
   ```bash
   pnpm exec tsx scripts/sync-obsidian.ts
   ```

3. 启动开发服务器：
   ```bash
   pnpm dev
   ```
<!-- MANUAL ADDITIONS END -->
