# Digital Biome 架构设计

## 三位一体架构

同一数据源，三种布局，服务三类受众。

```
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Content Collections)              │
│   blog/     wiki/     bookmarks/     meta/                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    视图层 (Layouts)                          │
│   DashboardLayout   WikiLayout   ResumeLayout               │
│   极简/工具优先      侧边栏/阅读   精美/展示                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    路由层 (Pages)                            │
│      /              /wiki/[...slug]        /resume          │
│   Dashboard          知识库               简历               │
└─────────────────────────────────────────────────────────────┘
```

## 设计原则

### 1. 静态优先

- 所有页面在构建时生成 HTML
- 客户端 JavaScript 最小化
- Islands Architecture：交互组件按需水合

### 2. 内容即数据

- Content Collections 作为单一数据源
- YAML/Markdown frontmatter 定义 schema
- 类型安全的查询接口

### 3. 布局分离

每种布局独立优化：

| Layout | 目标用户 | 设计目标 |
|--------|----------|----------|
| Dashboard | 自己 | 效率、快速访问 |
| Wiki | 同行/读者 | 沉浸阅读、导航 |
| Resume | 面试官/甲方 | 视觉冲击、打印友好 |

## 数据层

### Content Collections Schema

```
src/content/
├── config.ts           # 集合定义和 schema
├── blog/               # 博客文章
├── wiki/               # 知识库 (category 组织)
├── bookmarks/          # 书签分组 (YAML 配置)
└── meta/               # 元数据 (resume.yaml)
```

### 查询模式

```typescript
const posts = await getCollection('blog');
const wikiPages = await getCollection('wiki');
```

## 视图层

### Dashboard Layout

- 搜索框 + 书签网格 + 快捷链接
- 无侧边栏，最大化内容区
- 支持 URL 快捷命令 (g, gh, tr 等)

### Wiki Layout

- 左侧：文件树导航（按 category 分组）
- 右侧：文章大纲 (TOC)
- 中间：Markdown 渲染

### Resume Layout

- 无干扰布局
- 时间轴样式
- 打印媒体查询优化

## 路由映射

| URL | 页面文件 | Layout |
|-----|----------|--------|
| `/` | `pages/index.astro` | DashboardLayout |
| `/resume` | `pages/resume.astro` | ResumeLayout |
| `/wiki` | `pages/wiki/index.astro` | WikiLayout |
| `/wiki/[...slug]` | `pages/wiki/[...slug].astro` | WikiLayout |
| `/blog` | `pages/blog/index.astro` | BlogLayout |
| `/blog/[slug]` | `pages/blog/[slug].astro` | BlogLayout |

## 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Astro | 静态优先、岛屿架构、零 JS 默认 |
| 内容管理 | Content Collections | 类型安全、schema 验证、统一查询 |
| 部署 | Netlify | 边缘函数、自动部署、免费额度 |
| 包管理 | pnpm | 磁盘效率、严格依赖、monorepo 友好 |

## 扩展点

功能开发使用 speckit 工作流：

```
specs/[feature]/
├── spec.md      # 功能规格
├── plan.md      # 实现计划
└── tasks.md     # 开发任务
```
