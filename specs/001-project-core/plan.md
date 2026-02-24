# Implementation Plan: Digital Biome Project Core

**Branch**: `001-project-core` | **Date**: 2026-02-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-project-core/spec.md`

## Summary

Digital Biome 是一个以 Obsidian 笔记为单一数据源的个人站点，包含四个核心模块：起始页导航（从笔记提取书签）、笔记花园（支持双链的 Wiki）、个人主页、在线简历。采用 Astro 静态构建，通过 Git Submodule 引入 Obsidian 仓库，部署于 Netlify。

## Technical Context

**Language/Version**: TypeScript 5.9.x  
**Primary Dependencies**: Astro 5.x, @astrojs/netlify  
**Storage**: Git Submodule (Obsidian vault) + Content Collections  
**Testing**: Vitest (待配置)  
**Target Platform**: Web (静态站点，Netlify 托管)
**Project Type**: web-application (静态站点)  
**Performance Goals**: LCP < 2.5s, FID < 100ms, CLS < 0.1, 搜索 < 500ms  
**Constraints**: 纯静态构建，无服务端渲染，客户端 JavaScript 最小化  
**Scale/Scope**: 1000+ 笔记，4 个页面模块，单用户（站长）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Component-First Architecture | ✅ PASS | 使用 Astro 组件，Islands Architecture |
| II. Performance & Bundle Optimization | ✅ PASS | 静态构建，Core Web Vitals 目标已定义 |
| III. Testing Discipline | ⚠️ PENDING | 测试框架待配置，需在 Phase 2 完成 |
| IV. Simplicity | ✅ PASS | 使用 Astro 原生方案，Content Collections |
| V. Documentation | ✅ PASS | 规格文档完整，TypeScript 类型定义 |

**Technology Stack Compliance**:
| Layer | Constitution | Planned | Status |
|-------|--------------|---------|--------|
| Framework | Astro 5.x | Astro 5.x | ✅ |
| Language | TypeScript | TypeScript | ✅ |
| Package Manager | pnpm | pnpm | ✅ |
| Deployment | Netlify | Netlify | ✅ |
| Styling | CSS/Scoped | CSS/Scoped | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/001-project-core/
├── spec.md              # 功能规格
├── plan.md              # 本文件
├── research.md          # Phase 0 调研结果
├── data-model.md        # Phase 1 数据模型
├── quickstart.md        # Phase 1 快速开始指南
├── contracts/           # Phase 1 接口契约
│   └── routes.md        # 路由定义
└── checklists/          # 检查清单
    └── requirements.md  # 规格质量检查
```

### Source Code (repository root)

```text
src/
├── content/
│   ├── config.ts           # Content Collections schema (已存在)
│   ├── blog/               # 博客文章 (已存在)
│   ├── wiki/               # Wiki 笔记 (已存在)
│   ├── bookmarks/          # 书签配置 (已存在)
│   ├── meta/               # 简历数据 (已存在)
│   └── notes/              # Git Submodule 挂载点 (待创建)
├── pages/
│   ├── index.astro         # Dashboard 起始页 (已存在，需改造)
│   ├── home.astro          # 个人主页 (待创建)
│   ├── resume.astro        # 简历页 (已存在)
│   └── wiki/               # Wiki 模块 (已存在)
├── layouts/
│   ├── Layout.astro        # 基础布局 (已存在)
│   ├── DashboardLayout.astro # 起始页布局 (已存在)
│   ├── WikiLayout.astro    # Wiki 布局 (已存在)
│   └── ResumeLayout.astro  # 简历布局 (已存在)
├── components/
│   ├── common/             # 通用组件 (已存在)
│   ├── dashboard/          # 起始页组件 (已存在，需改造)
│   └── wiki/               # Wiki 组件 (已存在)
├── utils/
│   ├── helpers.ts          # 工具函数 (已存在)
│   ├── date.ts             # 日期处理 (已存在)
│   └── notes.ts            # 笔记处理 (待创建)
└── styles/
    └── global.css          # 全局样式 (已存在)

vault/
└── z/                      # Git Submodule: Obsidian vault (待配置)
```

**Structure Decision**: 基于现有 Astro 项目结构，复用已有 Content Collections 和布局组件。新增 `src/content/notes/` 作为 Git Submodule 挂载点，新增 `src/pages/home.astro` 作为个人主页。

## Complexity Tracking

> 无违反宪法的情况，无需记录。

---

## Phase 0: Research Summary

详见 [research.md](./research.md)

### 关键技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 双链解析 | 自定义 remark 插件 | 轻量、可控、无额外依赖 |
| 搜索实现 | Pagefind | Astro 官方推荐，静态友好 |
| Git Submodule 处理 | 构建时脚本 + 错误中断 | 简单可靠，符合约束 |
| 私有笔记过滤 | Content Collections schema | 利用 Astro 原生能力 |

---

## Phase 1: Design Artifacts

- [data-model.md](./data-model.md) - 数据模型定义
- [contracts/routes.md](./contracts/routes.md) - 路由契约
- [quickstart.md](./quickstart.md) - 快速开始指南

---

## Next Steps

运行 `/speckit.tasks 001-project-core` 生成开发任务列表。
