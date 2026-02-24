# Routes Contract: Digital Biome Project Core

**Date**: 2026-02-22  
**Feature**: 001-project-core

## Route Overview

| Route | Page | Layout | Description |
|-------|------|--------|-------------|
| `/` | index.astro | DashboardLayout | 起始页/书签导航 |
| `/home` | home.astro | Layout | 个人主页 |
| `/wiki` | wiki/index.astro | WikiLayout | 笔记花园首页 |
| `/wiki/[...slug]` | wiki/[...slug].astro | WikiLayout | 笔记详情页 |
| `/resume` | resume.astro | ResumeLayout | 在线简历 |

---

## Route Details

### 1. `/` - 起始页

**Layout**: DashboardLayout

**Purpose**: 浏览器起始页，展示从笔记提取的书签

**Data Requirements**:
- Bookmarks (按 Category 分组)
- Categories 列表

**Components**:
- SearchBox (搜索框)
- BookmarkGrid (书签网格)
- QuickLinks (快捷链接)

**Behavior**:
- 静态生成
- 支持搜索框快捷命令
- 无 JavaScript 时仍可导航

---

### 2. `/home` - 个人主页

**Layout**: Layout (基础布局)

**Purpose**: 网站门面，展示个人介绍和最近更新

**Data Requirements**:
- 个人简介 (Meta collection)
- 最近 5 篇笔记 (按 Git 修改时间)
- 导航链接

**Components**:
- Hero (个人介绍)
- RecentNotes (最近笔记列表)
- Navigation (导航入口)

**Behavior**:
- 静态生成
- 响应式设计

---

### 3. `/wiki` - 笔记花园首页

**Layout**: WikiLayout

**Purpose**: 知识库入口，展示分类导航和笔记列表

**Data Requirements**:
- 所有公开笔记
- 分类结构
- 搜索索引

**Components**:
- WikiSidebar (分类导航)
- NoteList (笔记列表)
- SearchBox (搜索框)

**Behavior**:
- 静态生成
- 客户端搜索 (Pagefind)
- 标签筛选

---

### 4. `/wiki/[...slug]` - 笔记详情页

**Layout**: WikiLayout

**Purpose**: 展示单篇笔记内容，支持双链跳转

**Data Requirements**:
- 笔记内容 (Markdown)
- 笔记元数据
- 目录结构 (TOC)
- 相关笔记推荐

**Components**:
- WikiSidebar (分类导航)
- TableOfContents (目录)
- NoteContent (笔记内容)
- Backlinks (反向链接)

**Behavior**:
- 静态生成
- 双链可点击跳转
- 不存在的双链显示为虚线文本

**Dynamic Segments**:
- `[...slug]` 匹配任意路径深度
- 例如: `/wiki/resources/notion` → slug = `resources/notion`

---

### 5. `/resume` - 简历页

**Layout**: ResumeLayout

**Purpose**: 在线简历，支持打印

**Data Requirements**:
- 简历数据 (Meta collection)
- 工作经历
- 教育背景
- 技能
- 项目

**Components**:
- Header (联系信息)
- Experience (工作经历时间轴)
- Education (教育背景)
- Skills (技能列表)
- Projects (项目列表)

**Behavior**:
- 静态生成
- 打印优化 (@media print)
- 无干扰布局

---

## Static Generation

所有页面均为静态生成 (SSG):

```typescript
// 构建时生成所有路由
export async function getStaticPaths() {
  const notes = await getCollection('wiki');
  return notes
    .filter(note => !note.data.draft && !note.data.private)
    .map(note => ({
      params: { slug: note.slug },
      props: { note }
    }));
}
```

---

## Navigation Structure

```
导航栏 (Header)
├── Home (/home)
├── Wiki (/wiki)
├── Resume (/resume)
└── 起始页 (/) [快捷键: 点击 Logo]

Wiki 侧边栏
├── 分类 A
│   ├── 笔记 1
│   └── 笔记 2
├── 分类 B
│   └── 笔记 3
└── ...
```

---

## Search Contract

### Pagefind 集成

**索引范围**: `/wiki/**` 下所有笔记

**搜索字段**:
- title (权重高)
- description
- tags
- content (可选)

**API**:
```typescript
// 客户端搜索
import { search } from '@pagefind/default-ui';

const results = await search('关键词');
// 返回: { results: [{ url, title, excerpt }] }
```

---

## Error States

| 场景 | 处理方式 |
|------|----------|
| 笔记不存在 | 404 页面 |
| 搜索无结果 | "未找到相关笔记" 提示 |
| 分类下无书签 | 空状态提示 |
| Git Submodule 失败 | 构建失败，输出错误 |
