---
title: "Astro 快速入门指南"
description: "学习如何使用 Astro 框架构建高性能网站"
pubDate: 2026-01-12
tags: [astro, web-development, tutorial]
draft: false
---

## 什么是 Astro？

Astro 是一个现代的 Web 框架，专注于构建快速、内容驱动的网站。

## 主要特点

### 🚀 性能优先
- 零 JavaScript 默认
- 仅加载必需的 CSS
- 图像优化

### 🎨 多框架支持
- React
- Vue
- Svelte
- 还有更多...

### 📝 内容友好
- Markdown 支持
- 内容集合
- 动态路由

## 快速开始

```bash
# 创建新项目
npm create astro@latest my-project

# 进入项目目录
cd my-project

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 项目结构

```
src/
├── pages/           # 路由页面
├── components/      # React/Vue/Svelte 组件
├── layouts/         # 页面布局
├── content/         # Markdown 内容
└── styles/          # CSS 样式
```

## 内容集合

Astro 的内容集合让你可以轻松管理和验证内容。

### 定义集合 (config.ts)

```typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
  }),
});

export const collections = { blog };
```

### 使用集合

```astro
---
import { getCollection } from 'astro:content';

const posts = await getCollection('blog');
---
```

## 部署

### Vercel

```bash
npm i -g vercel
vercel
```

### Netlify

```bash
npm i -g netlify-cli
netlify deploy
```

## 学习资源

- [Astro 官方文档](https://docs.astro.build)
- [Astro 教程](https://docs.astro.build/en/tutorial/0-introduction/)
- [社区示例](https://astro.build/showcase/)

---

希望这个入门指南对你有帮助！有问题欢迎提问。
