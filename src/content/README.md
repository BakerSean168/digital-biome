# Content Collections

内容管理指南。

## 集合结构

| 集合 | 目录 | 格式 | 用途 |
|------|------|------|------|
| notes | `src/data/obsidian/` | Markdown | `knowledge-public-v1` 物化后同步生成 |

## 笔记系统

笔记事实由 Thought Forest / Obsidian 拥有。Digital Biome 使用 committed `knowledge-public-v1` lock 验证 producer-owned 公开投影，再通过 `pnpm sync` 物化到 `src/data/obsidian/`。

### 笔记 frontmatter 示例

```markdown
---
title: "笔记标题"
description: "简短描述"
tags:
  - status/growing
  - tech/lang/typescript
  - type/concept
created: 2026-02-22
updated: 2026-02-25
draft: false
---

正文内容...

支持 [[双链]] 语法链接到其他笔记。
```

### 层级标签

标签使用 `/` 分隔的层级格式：

| 维度 | 示例 | 用途 |
|------|------|------|
| `status/` | `status/growing`, `status/evergreen` | 笔记成熟度 |
| `tech/` | `tech/lang/typescript`, `tech/dev`, `tech/ops` | 技术分类 |
| `type/` | `type/concept`, `type/howto`, `type/moc`, `type/resource` | 笔记类型 |
| `life/` | `life/material`, `life/shopping` | 生活相关 |
| `website/` | `website/video`, `website/dev/tool` | 书签分类（自动显示在首页） |

### 书签笔记

带有 `type/resource` 标签和 `url` 字段的笔记会自动作为书签显示在首页：

```markdown
---
title: "YouTube"
description: "视频分享平台"
url: https://youtube.com
tags:
  - type/resource
  - website/video
icon: youtube
rating: 4
---
```


## 私有笔记

在 Obsidian vault 中设置 `draft: true` 或 `private: true` 可隐藏笔记：

```markdown
---
title: "私人日记"
draft: true
---
```

## 同步流程

1. Thought Forest 发布 immutable `knowledge-public-v1` producer Release
2. Digital Biome lock 固定 source revision、Release tag 与 artifact/manifest digest
3. `pnpm sync` 验证 lock 并物化只读 source，再同步到 `src/data/obsidian/`
4. 图片资源同步到 `public/vault-assets/`，索引生成到 `src/data/indexes/`
5. 构建时 Astro Content Collections 读取同步后的公开笔记

## Schema 定义

见 `config.ts`。
