# Digital Biome 架构设计

## 架构概览

基于 Obsidian vault 的个人知识站点，同一数据源，多种布局，服务不同场景。

```
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Content Collections)              │
│   notes/obsidian/          meta/                            │
│   (Obsidian vault 同步)     (简历等元数据)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    视图层 (Layouts)                          │
│   DashboardLayout    NotesLayout      BaseLayout            │
│   极简/工具优先       侧边栏/阅读      通用壳                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    路由层 (Pages)                            │
│      /              /notes/[...slug]      /about/resume     │
│   Dashboard          笔记详情              简历               │
└─────────────────────────────────────────────────────────────┘
```

## 设计原则

### 1. 静态优先

- 所有页面在构建时生成 HTML
- 客户端 JavaScript 最小化
- Islands Architecture：交互组件按需水合

### 2. 内容即数据

- Obsidian vault 为唯一内容来源
- `pnpm sync` 同步 vault 到 Content Collections
- YAML frontmatter 定义 schema，支持层级标签
- 类型安全的查询接口

### 3. 布局分离

| Layout | 目标用户 | 设计目标 |
|--------|----------|----------|
| Dashboard | 自己 | 效率、快速访问 |
| Notes | 同行/读者 | 沉浸阅读、导航 |
| Resume | 面试官/甲方 | 视觉冲击、打印友好 |

## 数据层

### Content Collections Schema

```
src/content/
├── config.ts              # 集合定义和 schema
├── notes/obsidian/        # 笔记（同步生成，.gitignored）
└── meta/                  # 元数据 (resume.yaml)
```

### 查询模式

```typescript
const notes = await getCollection('notes');
```

## 视图层

### Dashboard Layout

- 搜索框 + 书签网格 + 快捷链接
- 无侧边栏，最大化内容区

### Notes Layout

- 左侧：分类导航（按层级标签根维度分组）
- 右侧：文章大纲 (TOC)
- 中间：Markdown 渲染 + 反向链接

### Resume Layout

- 无干扰布局
- 时间轴样式
- 打印媒体查询优化

## 路由映射

| URL | 页面文件 | Layout |
|-----|----------|--------|
| `/` | `pages/index.astro` | DashboardLayout |
| `/about` | `pages/about/index.astro` | BaseLayout |
| `/about/resume` | `pages/about/resume.astro` | BaseLayout |
| `/notes` | `pages/notes/index.astro` | NotesLayout |
| `/notes/[...slug]` | `pages/notes/[...slug].astro` | NotesLayout |

## 标签系统

笔记使用层级标签（Hierarchical Tags），格式为 `维度/子分类/...`：

| 维度 | 示例 | 用途 |
|------|------|------|
| `status/` | `status/growing`, `status/evergreen` | 笔记成熟度 |
| `tech/` | `tech/lang/typescript`, `tech/ops` | 技术领域分类 |
| `type/` | `type/concept`, `type/howto`, `type/moc` | 笔记类型 |
| `life/` | `life/material`, `life/shopping` | 生活相关 |
| `website/` | `website/video`, `website/dev/tool` | 书签分类 |

## 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Astro | 静态优先、岛屿架构、零 JS 默认 |
| 内容管理 | Content Collections | 类型安全、schema 验证、统一查询 |
| 笔记来源 | Obsidian vault (submodule) | 本地编辑体验、成熟的知识管理生态 |
| 部署 | Netlify | 边缘函数、自动部署、免费额度 |
| 包管理 | pnpm | 磁盘效率、严格依赖 |
