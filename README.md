# Digital Biome

个人知识生态站点：Dashboard（启动页）+ Notes（笔记）+ Resume（简历）

基于 Obsidian vault 构建，支持层级标签、双链 `[[wikilink]]`、反向链接。

## 快速开始

```bash
pnpm install      # 安装依赖
pnpm sync         # 同步 Obsidian 笔记到内容目录
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
│   ├── about/       # 关于页 + 简历
│   └── notes/       # 笔记列表 + 详情
├── layouts/         # 页面布局
├── components/      # UI 组件
│   ├── common/      # 通用组件（Header, Footer, ThemeIcon, SiteSearch）
│   ├── dashboard/   # 起始页组件
│   ├── resume/      # 简历组件
│   └── notes/       # 笔记组件（侧边栏、目录、反向链接）
├── content/         # 内容集合
│   ├── notes/       # 笔记（Obsidian 同步，.gitignored）
│   └── meta/        # 简历数据
├── utils/           # 工具函数 / Remark 插件
├── types/           # TypeScript 类型
└── styles/          # 全局样式

vault/               # Git Submodule: Obsidian vault
public/              # 静态资源
docs/                # 文档
specs/               # 功能规格
```

## 内容管理

见 [src/content/README.md](src/content/README.md)

## 部署

项目已配置 Netlify 适配器，推送到 GitHub 后自动部署。

部署前更新：
- `astro.config.mjs` -> `site` 字段
- `src/constants.ts` -> 个人信息

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 5.x |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide Icons |
| 包管理 | pnpm |
| 部署 | Netlify |

## 文档

- [功能路线图](ROADMAP.md)
- [架构设计](docs/architecture.md)
