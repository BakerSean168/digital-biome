# Digital Biome

个人知识生态站点：Dashboard（启动页）+ Notes（笔记）+ Resume（简历）

基于 Obsidian vault 构建，支持层级标签、双链 `[[wikilink]]`、反向链接。

## 快速开始

```bash
git submodule update --init --recursive # 初始化私有笔记子模块
pnpm install --frozen-lockfile          # 安装依赖
pnpm sync                              # 生成公开内容投影和静态索引
pnpm dev:only                          # 启动开发服务器 (localhost:4321)
pnpm check                             # Astro/TypeScript 检查
pnpm build:only                        # 使用已同步内容验证生产构建
```

## 架构

见 [docs/architecture.md](docs/architecture.md)

## 项目结构

```
src/
├── pages/             # Astro 路由（Dashboard、Notes、Infrastructure 等）
├── layouts/           # Base/Dashboard/Notes 页面壳
├── components/        # common、dashboard、notes、assets UI
├── content/config.ts  # Astro Content Collection schema
├── data/              # 同步后的 Markdown、索引和站点数据
├── domain/            # Note ID、路由、可见性与 wikilink 规则
├── repositories/      # 静态索引查询隔离层
├── view-models/       # 页面展示模型
├── utils/             # Remark 与通用工具
├── types/             # TypeScript 类型
└── styles/            # 全局样式与 Tailwind 入口

edge/                  # Access JWT、私有 payload 与 private_ref 规则
functions/             # Cloudflare Pages Functions
scripts/sync/          # Vault 同步、脱敏和索引生成
thought-forest/        # 私有 Obsidian vault Git Submodule
public/_routes.json    # Functions 调用范围
docs/                  # 架构、开发、部署与运维文档
```

## 内容管理

笔记来自私有 `thought-forest` 子模块，经同步、过滤和脱敏后写入
`src/data/obsidian/`，索引写入 `src/data/indexes/`。完整流程见
[笔记同步与公开投影](docs/notes-sync-process.md)。

GitHub 贡献图使用已提交的 `src/data/github-contributions.json` 快照，构建过程不会
联网改写源码。需要更新时显式运行 `pnpm refresh:github-contributions`，检查差异后
与普通源码一起提交。

## 部署

生产环境使用 Cloudflare Pages + Pages Functions。`/api/private/*` 由 Cloudflare
Access 保护，Functions 会再次验证 Access JWT；私有基础设施值只存放在加密的
`PRIVATE_INFRASTRUCTURE_JSON` secret 中，不进入静态 HTML 或 Pagefind 索引。

```bash
pnpm deploy:cloudflare
```

Cloudflare Git 自动构建当前已关闭：私有 `thought-forest` 子模块无法在 Pages
Git 克隆阶段取得凭据。生产发布由 GitHub Actions 使用只读 GitHub App 短期令牌
检出两个仓库，经 `production` Environment 审批后通过 Wrangler 直接部署。
日常操作见 [开发、部署与运维手册](docs/development-deployment-operations.md)，
控制面配置见 [Cloudflare Pages 与 Access](docs/cloudflare-deployment.md)。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Astro 5.x |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide Icons |
| 包管理 | pnpm |
| 部署 | Cloudflare Pages + Access |

## 文档

- [功能路线图](ROADMAP.md)
- [架构设计](docs/architecture.md)
- [开发、部署与运维手册](docs/development-deployment-operations.md)
- [笔记同步与公开投影](docs/notes-sync-process.md)
- [Cloudflare Pages、Functions 与 Access](docs/cloudflare-deployment.md)
- [ADR-0001：私有 Vault 与 Pages 直接部署](docs/adr/0001-private-vault-direct-pages-deployment.md)
- [资产架构设计](docs/asset-architecture.md)
- [基础设施展示页信息架构与视觉方案](docs/infrastructure-showcase-design.md)
