# Quickstart: Digital Biome Project Core

**Date**: 2026-02-22  
**Feature**: 001-project-core

## Prerequisites

- Node.js 18+
- pnpm
- Git
- Obsidian vault 仓库访问权限

---

## 1. 克隆项目

```bash
git clone <repo-url>
cd digital-biome
pnpm install
```

---

## 2. 配置 Git Submodule

### 2.1 添加 Obsidian vault

```bash
# 添加 submodule 到 vault/z 目录
git submodule add <obsidian-vault-repo-url> vault/z

# 初始化 submodule
git submodule update --init --recursive
```

### 2.2 Netlify 配置 (部署)

1. 在 Netlify Dashboard → Site Settings → Build & Deploy → Deploy Key
2. 添加 Obsidian vault 仓库的 Deploy Key（读取权限即可）
3. 或使用 Git Token 方式认证

---

## 3. 本地开发

```bash
# 启动开发服务器
pnpm dev

# 访问 http://localhost:4321
```

---

## 4. 笔记格式要求

### 4.1 标准 Wiki 笔记

```markdown
---
title: 我的笔记
description: 简短描述
tags:
  - category/技术
created: 2026-02-22
---

# 笔记标题

正文内容...

这里有一个 [[双链]] 指向其他笔记。
```

### 4.2 资源/书签笔记

```markdown
---
title: YouTube
description: 视频分享平台
url: https://youtube.com
tags:
  - type/resource
  - website/video
  - source/youtube
icon: 📺
rating: 4
---

# YouTube

详细的介绍内容...
```

### 4.3 私有笔记

```markdown
---
title: 个人日记
draft: true
# 或
private: true
---

这篇笔记不会发布到网站。
```

---

## 5. 标签体系

| 标签前缀 | 用途 | 示例 |
|----------|------|------|
| `type/` | 内容类型 | `type/resource`, `type/note` |
| `website/` | 书签分类 | `website/video`, `website/tool` |
| `source/` | 来源平台 | `source/github`, `source/youtube` |
| `category/` | Wiki 分类 | `category/技术`, `category/生活` |

---

## 6. 自定义配置

### 6.1 站点信息

编辑 `src/constants.ts`:

```typescript
export const SITE_TITLE = 'Digital Biome';
export const SITE_AUTHOR = '你的名字';
export const SITE_URL = 'https://your-domain.com';
```

### 6.2 Astro 配置

编辑 `astro.config.mjs`:

```javascript
export default defineConfig({
  site: 'https://your-domain.com',
  // ...
});
```

### 6.3 简历数据

编辑 `src/content/meta/resume.yaml`:

```yaml
name: 你的名字
title: 职位头衔
contact:
  email: your@email.com
  github: github.com/username
experience:
  - role: 职位
    company: 公司
    period: 2024 - Present
    highlights:
      - 成就1
      - 成就2
```

---

## 7. 构建与部署

### 7.1 本地构建

```bash
# 构建生产版本
pnpm build

# 预览
pnpm preview
```

### 7.2 Netlify 部署

项目已配置 `netlify.toml`，推送代码后自动部署。

```bash
git add .
git commit -m "feat: initial setup"
git push
```

---

## 8. 验证清单

- [ ] Git Submodule 已正确初始化
- [ ] `pnpm dev` 可正常启动
- [ ] 起始页 `/` 显示书签
- [ ] Wiki `/wiki` 显示笔记
- [ ] 简历 `/resume` 可正常访问
- [ ] `pnpm build` 构建成功

---

## 常见问题

### Q: Submodule 初始化失败

确保有 Obsidian vault 仓库的读取权限。如果是私有仓库，需要配置 Deploy Key。

### Q: 笔记不显示

检查 frontmatter 格式是否正确，确保 `draft` 和 `private` 不是 `true`。

### Q: 搜索不工作

运行 `pnpm build` 后 Pagefind 才会生成索引。开发模式下搜索不可用。

### Q: 双链指向不存在的笔记

系统会显示为带虚线样式的文本，这是预期行为。
