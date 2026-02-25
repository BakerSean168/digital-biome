# Content Collections

内容管理指南。

## 集合结构

| 集合 | 目录 | 格式 | 用途 |
|------|------|------|------|
| notes | `wiki/obsidian/` | Markdown | 笔记 |
| bookmarks | `bookmarks/` | YAML | Dashboard 书签 |
| meta | `meta/` | YAML | 元数据（简历等） |

## 添加笔记


在 `wiki/obsidian/` 创建 `.md` 文件：

```markdown
---
title: "笔记标题"
description: "简短描述"
category: 分类名称
tags:
  - type/note
  - category/技术
created: 2026-02-22
draft: false
private: false
---

正文内容...

支持 [[双链]] 语法链接到其他笔记。
```

### 笔记类型

| type 值 | 用途 |
|---------|------|
| `type/note` | 普通笔记 |
| `type/resource` | 资源/书签（需配合 `url` 字段） |
| `type/tool` | 工具 |
| `type/article` | 文章 |

### 书签笔记示例

```markdown
---
title: "YouTube"
description: "视频分享平台"
url: https://youtube.com
tags:
  - type/resource
  - website/video
icon: 📺
rating: 4
---

详细的介绍内容...
```

书签会自动出现在起始页的分类区块中。

## 添加书签分组（YAML 方式）

在 `bookmarks/` 创建 `.yaml` 文件：

```yaml
title: 分组名称
icon: 🔧
order: 1
links:
  - name: 链接名称
    url: https://example.com
    icon: 🔗
    description: 可选描述
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
  linkedin: linkedin.com/in/username
experience:
  - role: 职位
    company: 公司
    period: 2024 - Present
    highlights:
      - 成就1
      - 成就2
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

设置 `draft: true` 或 `private: true` 可隐藏笔记：

```markdown
---
title: "私人日记"
draft: true
# 或
private: true
---

这篇笔记不会发布到网站。
```

## Obsidian 同步

1. 配置 Git Submodule 指向 Obsidian vault
2. 确保笔记有标准 frontmatter
3. 构建时自动处理

## Schema 定义

见 `config.ts`。
