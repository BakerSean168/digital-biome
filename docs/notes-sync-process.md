# 笔记同步与内容处理流程

本文档详述了如何通过 Git Submodule 获取外部（例如 Obsidian）笔记，进行处理、同步，并在 Astro 框架中加载与筛选过滤的完整流程。

## 架构概览

```
  Git Submodule (Obsidian Vault)
          ↓
  pnpm sync (scripts/sync-obsidian.ts)
          ↓ (配置项：notes.config.ts)
  处理过程：提取 Markdown -> Frontmatter 标准化 -> 重写图片路径
          ↓
  写入目标目录：
    Wiki 内容: src/content/wiki/obsidian/*.md
    静态资源: public/vault-assets/*
          ↓
  Astro Content Collections (src/content/config.ts)
          ↓
  数据验证及 Schema 解析 (Zod) -> 生成 `notes` Collection
          ↓
  UI 层过滤渲染 (例如按 `draft`, `private` 过滤)
```

## 1. 笔记数据源 (Git Submodule)

项目通过 Git Submodule (`thought-forest/z`) 引入一个外部笔记仓库。该仓库包含了由 Obsidian 撰写的原始 Markdown 笔记和关联的图片资源库 (如 `thought-forest/assets`)。

**配置文件 (`notes.config.ts`)**
负责统一管理路径映射，指明了 `vault` 源路径和需要拷贝资源的输出路径，配置如下：
- `vault.path`: 指向 `thought-forest/z`
- `vault.assets`: 指向图片源目录
- `output.wiki`: Markdown 目标的输出目录 `src/content/wiki/obsidian`
- `output.assets`: 静态图片资源的公共目录 `public/vault-assets`

## 2. 同步与预处理 (`scripts/sync-obsidian.ts`)

开发中可通过 `pnpm sync` 执行该脚本。脚本核心功能包括：
1. **收集资产与图片复制**：将 `vault/assets/` 里的资源（如图片）拷贝到 `public/vault-assets/` 下。
2. **重写图片路径 (`rewriteImagePaths`)**：
   - 识别 Obsidian 特有语法 (`![[image.png]]`) 并转换为标准 Markdown (`![image](/vault-assets/image.png)`)。
   - 更新标准 Markdown 的本地图片路径前缀，指向 `/vault-assets/`。
3. **内容预处理 (`processContent`)**：
   - 读取原文件。如果文件缺乏 frontmatter（即不以 `---` 开头），则自动生成包裹文件名的 title 并在 frontmatter 中进行标准化补齐。
   - 处理完的文件将被写入 `src/content/wiki/obsidian`。
4. **清理过期文件 (`cleanStalledFiles`)**：检测 `wiki/obsidian` 内多余的或已经从 vault 删除的笔记，并进行清理，确保两端数据同步一致。

## 3. Astro 数据加载与 Schema 验证

经过前置脚本同步后的 `.md` 文件此时均存放于 `src/content/wiki/obsidian`。随后 Astro 依靠 Content Collections API 加载并组织这些文件数据。

**配置解析 (`src/content/config.ts`)**
- **Glob Loader**：使用 `glob()` 指明加载范围为 `src/content/wiki/obsidian/**/*.md`，并自定义生成 `id`（例如：`obsidian/<filename>`）。
- **Schema Validation**：
  利用 `z.record(z.unknown()).transform(...)` 对 frontmatter 的字段提取并标准化。重要字段：
  - `title`: 标题。
  - `tags`: 标签组。
  - `draft`: 是否为草稿（默认为 `false`）。
  - `private`: 是否私有（默认为 `false`）。
  - 其他如 `category`, `type` 等自定义元信息。

此部分的作用是将原先自由散漫的 Markdown Frontmatter，经过 Zod Schema 收束成类型安全的结构，以便后续通过 `getCollection('notes')` 一步提取全部数据。

## 4. 查询与筛选

在业务代码（页面如 `/wiki` 等）中，可直接引入并获取所有的笔记数据：

```typescript
import { getCollection } from 'astro:content';

// 获取所有经过 Astro 解析处理的笔记
const allNotes = await getCollection('notes');

// 基于 Frontmatter 内的配置筛选笔记，例如剔除草稿及私有笔记：
const publishedNotes = allNotes.filter(note => {
  return !note.data.draft && !note.data.private;
});
```

此阶段的筛选完全基于此前在 `src/content/config.ts` 的解析结果，保证了数据的透明一致性，并能安全地用于构建知识库、博客等不同的呈现层视图。
