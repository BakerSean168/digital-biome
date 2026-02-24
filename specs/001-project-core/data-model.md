# Data Model: Digital Biome Project Core

**Date**: 2026-02-22  
**Feature**: 001-project-core

## Entity Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Note (核心实体)                       │
│  - 来源: Obsidian vault (Git Submodule)                     │
│  - 存储: Content Collections                                 │
│  - 角色: Wiki 文章 / Bookmark 来源                           │
└─────────────────────────────────────────────────────────────┘
        │
        ├──► Bookmark (视图) ──► Category
        │
        └──► WikiLink (引用)
```

---

## Entities

### 1. Note (笔记)

**来源**: Obsidian vault 中的 Markdown 文件

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | 笔记标题，从 frontmatter 或文件名推断 |
| description | string | No | 简短描述 |
| content | string | Yes | Markdown 正文 |
| tags | string[] | No | 标签数组，如 `['type/resource', 'website/video']` |
| url | string (URL) | No | 外部链接（资源类笔记） |
| draft | boolean | No | 是否草稿，默认 false |
| private | boolean | No | 是否私有，默认 false |
| category | string | No | 分类名称 |
| aliases | string[] | No | 别名（Obsidian 兼容） |
| type | enum | No | `note` \| `resource` \| `tool` \| `article` |
| created | Date | No | 创建时间 |
| updated | Date | No | 更新时间 |
| icon | string | No | 图标 emoji |
| rating | number (1-5) | No | 评分 |
| platform | string | No | 平台 |
| pricing | enum | No | `free` \| `freemium` \| `paid` \| `subscription` |
| status | enum | No | `active` \| `archived` \| `deprecated` |

**Derived Fields (构建时计算)**:

| Field | Type | Description |
|-------|------|-------------|
| slug | string | URL 友好的标识符 |
| lastModified | Date | Git 最后修改时间 |
| isBookmark | boolean | 是否可作为书签展示 |
| categories | string[] | 提取的分类列表 |

**Validation Rules**:
- `draft: true` 或 `private: true` 的笔记不发布
- `title` 缺失时，从文件名推断（去除扩展名，转换下划线为空格）
- `url` 存在时必须是有效的 URL 格式

**State Transitions**: N/A (静态内容，无状态)

---

### 2. Bookmark (书签)

**来源**: Note 的视图（过滤 + 投影）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | 书签名称 |
| url | string (URL) | Yes | 链接地址 |
| description | string | No | 描述 |
| categories | string[] | Yes | 所属分类 |
| icon | string | No | 图标 |

**Selection Criteria**:
- `url` 字段存在
- `tags` 包含 `type/resource`
- `draft` 和 `private` 均为 false

---

### 3. Category (分类)

**来源**: 从 Note 的 `website/*` 标签自动生成

| Field | Type | Description |
|-------|------|-------------|
| name | string | 分类名称（如 `video`, `tool`） |
| slug | string | URL 友好标识 |
| bookmarks | Bookmark[] | 该分类下的书签列表 |

**生成规则**:
```typescript
// 从标签 website/video 提取分类 "video"
// 从标签 website/tool 提取分类 "tool"
```

---

### 4. WikiLink (双链)

**来源**: Markdown 内容中的 `[[...]]` 语法

| Field | Type | Description |
|-------|------|-------------|
| target | string | 目标笔记名 |
| displayText | string | 显示文本（可选） |
| exists | boolean | 目标笔记是否存在 |

**解析模式**:
- `[[笔记名]]` → target="笔记名", displayText="笔记名"
- `[[笔记名|显示文本]]` → target="笔记名", displayText="显示文本"

---

## Relationships

```
Note 1 ──────* WikiLink (引用其他笔记)
  │
  │ (筛选: url + type/resource)
  ▼
Bookmark * ────* Category (多对多)
```

---

## Content Collections Schema

```typescript
// src/content/config.ts

const wiki = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    private: z.boolean().default(false),
    type: z.enum(['note', 'resource', 'tool', 'article']).default('note'),
    url: z.string().url().optional(),
    category: z.string().optional(),
    aliases: z.array(z.string()).default([]),
    created: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    icon: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    platform: z.string().optional(),
    pricing: z.enum(['free', 'freemium', 'paid', 'subscription']).optional(),
    status: z.enum(['active', 'archived', 'deprecated']).optional(),
  }).passthrough(),
});
```

---

## Data Flow

```
1. Git Submodule 初始化
   └── vault/z/ (Obsidian vault)

2. Content Collections 解析
   └── Astro 读取 vault/z/**/*.md
   └── 解析 frontmatter + content

3. 构建时处理
   ├── 过滤 draft/private 笔记
   ├── 提取 Bookmarks
   ├── 生成 Categories
   ├── 解析 WikiLinks
   └── 计算最后修改时间

4. 页面生成
   ├── / (起始页) ← Bookmarks + Categories
   ├── /home (主页) ← 最近更新 Notes
   ├── /wiki (笔记花园) ← Notes + WikiLinks
   └── /resume (简历) ← Meta collection
```

---

## Index Strategy

### 搜索索引 (Pagefind)

构建时自动生成，包含：
- Note 标题
- Note 描述
- Note 标签
- Note 内容（可选，控制索引大小）

### 分类索引

构建时生成，格式：
```json
{
  "categories": [
    {
      "name": "video",
      "slug": "video",
      "count": 15
    }
  ]
}
```
