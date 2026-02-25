# digital-biome Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-22

## Active Technologies

- TypeScript 5.9.x + Astro 5.x, @astrojs/netlify (001-project-core)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.9.x: Follow standard conventions

## Recent Changes

- 001-project-core: Added TypeScript 5.9.x + Astro 5.x, @astrojs/netlify

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
