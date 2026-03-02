# Content Collections

内容管理指南。

## 集合结构

| 集合 | 目录 | 格式 | 用途 |
|------|------|------|------|
| notes | `notes/obsidian/` | Markdown | Obsidian 笔记（同步生成） |
| meta | `meta/` | YAML | 元数据（简历等） |

## 笔记系统

笔记内容来自 Obsidian vault（通过 git submodule 管理），使用 `pnpm sync` 同步到 `notes/obsidian/` 目录。

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

## 更新简历

编辑 `meta/resume.yaml`：

```yaml
name: 你的名字
title: 职位头衔
bio: 个人简介
contact:
  email: your@email.com
  github: github.com/username
experience:
  - role: 职位
    company: 公司
    period: 2024 - Present
    highlights:
      - 成就1
education:
  - degree: 学位
    school: 学校
    period: 2018 - 2022
skills:
  编程语言:
    - JavaScript
    - TypeScript
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

1. Obsidian vault 通过 git submodule 管理
2. 运行 `pnpm sync` 将 vault 笔记同步到 `notes/obsidian/`
3. 同步脚本会保留原始 frontmatter，补充缺失的 title 字段
4. 图片资源同步到 `public/vault-assets/`
5. 构建时 Astro Content Collections 读取同步后的笔记

## Schema 定义

见 `config.ts`。
