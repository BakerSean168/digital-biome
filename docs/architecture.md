# Digital Biome 架构设计与集成规范

本文档描述 `digital-biome` 前端网站的整体系统架构、同步流水线、查询层设计及与上游 `thought-forest` 知识库的集成规范。

---

## 1. 架构概览

`digital-biome` 采用 **“静态元数据索引 + 物理 Markdown 正文”** 的双通道解耦架构。核心链路流程如下：

```
┌───────────────────────────────┐
│     thought-forest 静态索引    │
│  (asset-index, link-graph等)  │
└───────────────┬───────────────┘
                │
                ▼ [pnpm sync] (物理同步管道)
┌─────────────────────────────────────────────────────────────┐
│                       数据与缓存层                           │
│   src/data/obsidian/       src/data/indexes/                │
│   (Markdown 物理正文)      (上游融合后的静态索引)            │
└───────┬───────────────────────────────┬─────────────────────┘
        │                               │
        │ (正文通道)                     │ (元数据通道)
        ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    查询隔离层 (Repositories)                 │
│   notes-repository.ts     assets-repository.ts              │
│   (按需调用 getEntry)      (静态内存加载 index.json)          │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
                └───────────┬───────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    路由与视图层 (Astro Pages)                │
│       /notes/[...slug]            /infrastructure/[assetId] │
│      (普通知识笔记详情)             (基础设施资产详情)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心设计原则

### 2.1 静态元数据优先
* 站内任何**列表查询、全局搜索、MOC 目录、反链查找、标签统计**，均严禁扫描物理文件或调用裸 `getCollection('notes')`。
* 上述业务一律只读取编译进内存的 `src/data/indexes/` 下的 JSON 数据，确保构建效率和检索速度。

### 2.2 双通道渲染 (Dual-Channel Rendering)
* 在详情页（如资产详情页）构建时：
  * **元数据**：由已融合上游字段的 `asset-index.json` 直接提供，保证 Quick Links 和 Monitoring 面板的信息准确性。
  * **文章正文**：根据 ID 显式调用 Astro 内置的 `getEntry('notes', noteId)` 载入物理 Markdown 文件，并对其调用 `render()` 编译，确保 HTML 渲染的高保真度与代码高亮（Shiki）效果。

### 2.3 运维/配置文档物理屏蔽
* 在 `knowledge-index-loader.ts` 过滤公开文章时，对以 `obsidian/config/` 开头的 note ID 进行拦截。
* 同步过来的 AI skills 操作说明、系统指令和 `AGENTS.md` 仅留在后端数据层，无法被公开发布至站点页面，防止语义污染。

---

## 3. 同步流水线机制 (`scripts/sync/`)

同步脚本通过分步 Module 实现状态校准：

| 模块 | 职责 |
|---|---|
| `source-adapter.ts` | 扫描上游目录并拷贝 Markdown 文件到内容库。提供 frontmatter 规范预检，捕获未闭合 YAML 引号等风险。 |
| `build-indexes.ts` | 扫描并提取同步后的笔记 frontmatter，在本地建立基础 notes/tags 静态索引。 |
| `merge-asset-index.ts` | 从配置的 `notesConfig.upstream.generatedPath` 读取上游由 gray-matter 解析出的 `asset-index.json`，把 monitor/links/homepage 合并到本地，补齐本地解析器的缺陷。 |
| `copy-upstream-indexes.ts` | 复制并覆盖上游已解析好的 `link-graph.json`，获取准确的出链与反向链接网络。 |
| `stale-cleaner.ts` | 检查并清除本地不再对应的陈旧 Markdown 缓存，防止路由死链。 |

---

## 4. 路由映射与布局

| 路由 | 页面源文件 | Layout 壳 | 查询源 |
|---|---|---|---|
| `/` | `pages/index.astro` | `DashboardLayout` | BiomeTree (最近创建/更新) 从 index 过滤读取 |
| `/notes` | `pages/notes/index.astro` | `NotesLayout` | 笔记目录，从 index 中按层级标签提取 |
| `/notes/[...slug]` | `pages/notes/[...slug].astro` | `NotesLayout` | `notes-repository` 提供路由，`render()` 渲染正文 |
| `/infrastructure/[assetId]` | `pages/infrastructure/[assetId].astro` | `BaseLayout` | 元数据自 `asset-index.json`，正文从 collection 编译 |
