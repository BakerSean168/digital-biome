# Digital Biome

三位一体个人站点：Dashboard（启动页）+ Wiki（知识库）+ Resume（简历）

## 快速开始

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动开发服务器 (localhost:4321)
pnpm build        # 构建生产版本
pnpm preview      # 预览构建结果
```

## 架构

见 [docs/architecture.md](docs/architecture.md)

## 项目结构

```
src/
├── pages/           # 路由页面
│   ├── index.astro  # Dashboard 起始页 (/)
│   ├── home.astro   # 个人主页
│   ├── resume.astro # 简历
│   └── wiki/        # 知识库
├── layouts/         # 页面布局
├── components/      # UI 组件
│   ├── common/      # 通用组件
│   ├── dashboard/   # 起始页组件
│   ├── home/        # 主页组件
│   ├── resume/      # 简历组件
│   └── wiki/        # Wiki 组件
├── content/         # Markdown 内容
│   ├── blog/        # 博客文章
│   ├── wiki/        # 知识库笔记
│   ├── bookmarks/   # 书签配置
│   └── meta/        # 简历数据
├── utils/           # 工具函数
├── types/           # TypeScript 类型
└── styles/          # 全局样式

vault/z/             # Git Submodule: Obsidian vault
public/              # 静态资源
docs/                # 文档
specs/               # 功能规格
```

## 内容管理

见 [src/content/README.md](src/content/README.md)

## 部署

项目已配置 Netlify 适配器，推送到 GitHub 后自动部署。

部署前更新：
- `astro.config.mjs` → `site` 字段
- `src/constants.ts` → 个人信息

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 5.x |
| 语言 | TypeScript |
| 包管理 | pnpm |
| 部署 | Netlify |

## 功能开发

使用 speckit 工作流开发新功能：

```
/speckit.specify <feature>   # 创建功能规格
/speckit.plan <feature>      # 生成实现计划
/speckit.tasks <feature>     # 分解开发任务
```

## 文档

- [功能路线图](ROADMAP.md)
- [架构设计](docs/architecture.md)
- [宪法](.specify/memory/constitution.md)
