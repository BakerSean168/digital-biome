# Digital Biome 开发、部署与运维手册

> 状态基线：2026-07-18
>
> 生产站点：`https://bakersean.top`
>
> Cloudflare Pages 项目：`digital-biome`
>
> 当前发布模式：关闭 Cloudflare Git 自动构建，由 GitHub Actions 审批后使用 Wrangler 直接部署。

## 1. 文档目的

本文是日常操作的唯一入口，覆盖：

- 新机器初始化；
- UI 与内容开发；
- 私有基础设施数据变更；
- 本地检查和生产构建；
- Cloudflare Pages 发布；
- Access、Secrets、验收、故障定位和回滚。

架构原因和长期问题见 [系统架构](architecture.md)。

## 2. 环境要求

| 工具            | 要求                                         | 来源                                    |
| --------------- | -------------------------------------------- | --------------------------------------- |
| Git             | 标准 clone / worktree                        | 系统安装                                |
| Node.js         | 24.x                                         | `.node-version`、`package.json#engines` |
| pnpm            | 10.x                                         | `packageManager: pnpm@10.32.1`          |
| Wrangler        | 项目依赖 4.x                                 | `pnpm install`                          |
| GitHub 权限     | 读取 `digital-biome` 和私有 `thought-forest` | 个人账号/专用凭据                       |
| Cloudflare 权限 | Pages 部署与 Secret 管理                     | Wrangler 登录或最小权限 API token       |

检查版本：

```bash
node --version
pnpm --version
git --version
pnpm exec wrangler --version
```

## 3. 新机器初始化

```bash
git clone <digital-biome-repository-url>
cd digital-biome
pnpm install --frozen-lockfile
gh auth status
pnpm sync
pnpm check
```

`pnpm sync` 根据 committed `data-products/knowledge-public-v1.lock.json` 下载并验证 producer Release。若未显式设置 `GH_TOKEN`，脚本会尝试复用 `gh auth token`。Digital Biome 不需要初始化 Thought Forest submodule。

## 4. 工作区输入与生成物

开发者需要理解三类文件：

### 4.1 版本控制输入

- Astro 页面、组件、样式和 TypeScript；
- `functions/` 与 `edge/`；
- `scripts/`、`notes.config.ts`；
- `wrangler.jsonc`、`public/_routes.json`；
- `src/data/github-contributions.json`（公开、可审查的 GitHub 贡献快照）；
- `data-products/knowledge-public-v1.lock.json`（公开 producer projection 的不可变输入身份）。

### 4.2 私有外部输入

- 默认：由 lock 验证并物化到 `.pds-runtime/knowledge-public-v1/source/` 的只读 public projection；
- 显式私有联调：`NOTES_VAULT_ROOT` / `NOTES_UPSTREAM_GENERATED` 指向的独立 Thought Forest checkout；
- Production：Release-pinned `.pds-runtime/private-thought-forest/` 临时 checkout；
- Cloudflare Pages Secrets。

### 4.3 可删除生成物

- `src/data/obsidian/`；
- `src/data/indexes/`；
- `public/vault-assets/`；
- `public/pagefind/`；
- `.astro/`；
- `dist/`；
- `tmp/`。

这些目录不应提交。出现缓存或重复 ID 问题时，可在确认路径后删除对应生成目录并重新运行 `pnpm sync`。

### 4.4 GitHub 贡献快照

`src/data/github-contributions.json` 不是可删除生成物，也不应加入 `.gitignore`。它是
生产构建的版本化输入；组件只读该文件，以避免构建时网络波动和工作区自动变脏。

需要刷新时运行：

```bash
pnpm refresh:github-contributions
git diff -- src/data/github-contributions.json
```

确认用户名、日期范围和贡献数合理后再提交。GitHub 会根据当前年度数据重新计算热力图
`level`，因此刷新时历史日期的等级变化并不一定表示贡献数发生变化。

## 5. 日常开发流程

### 5.1 只修改 UI 或前端逻辑

生成内容已经存在时：

```bash
pnpm dev:only
```

这是默认开发命令，避免每次启动都同步数千篇笔记和复制媒体。

完成修改后：

```bash
pnpm check
```

如果涉及 `edge/` 或 `functions/`：

```bash
pnpm check:edge
pnpm test:edge
```

### 5.2 更新公开笔记投影

Thought Forest main 发布新的 `knowledge-public-v1` 后，会 dispatch Digital Biome 的固定 automation PR。该 PR 只更新 committed lock，并在仓库策略要求时批准/等待该 bot PR 的受保护 CI。

本地要使用当前已提交 lock：

```bash
pnpm sync
pnpm dev:only
```

需要直接联调尚未进入 public projection 的私有 Thought Forest checkout 时：

```bash
NOTES_VAULT_ROOT=/path/to/thought-forest \
NOTES_UPSTREAM_GENERATED=/path/to/thought-forest/generated \
pnpm sync:content
pnpm dev:only
```

这种外部 checkout 不属于 Digital Biome Git 状态，也不应复制进仓库。

### 5.3 拉取已锁定投影并启动

```bash
pnpm dev
```

`pnpm dev` 会先执行 lock-backed `pnpm sync`，再启动 Astro。生成内容已存在时仍优先使用 `pnpm dev:only`。

### 5.4 同步 favicon

默认同步不会执行额外 favicon 获取：

```bash
pnpm sync -- --with-favicons
```

不要把它放进频繁开发循环。

## 6. 私有基础设施数据变更

下列变更都需要重新生成生产 payload：

- 新增、删除或重命名资产；
- 修改受保护链接的 URL、label、kind 或 visibility；
- 修改 host IP；
- 调整 `private_ref` 构造规则；
- 修改 Infrastructure Showcase 的 alias。

流程：

```bash
pnpm sync
pnpm export:private -- --out tmp/private-infrastructure.json
```

导出器会：

1. 从上游 `asset-index.json` 读取真实链接；
2. 使用 `edge/private-refs.ts` 生成与公开索引一致的 key；
3. 补充 Showcase 兼容 alias；
4. 用运行时 schema 校验 payload；
5. 写入被 Git 忽略的 `tmp/`。

禁止使用 `--print` 将真实 payload 打入共享终端日志。生产操作优先把文件直接上传为 Secret，然后安全删除临时文件。

### 6.1 本地占位数据

复制 `.dev.vars.example` 为 `.dev.vars`，只能使用文档保留地址或测试域名。普通 `astro dev` 不会签发 Cloudflare Access JWT，因此本地开发主要验证锁定 UI、payload parser 和边缘单元测试，不代表完成真实 Access 验收。

## 7. 提交前检查

### 7.1 最小前端检查

```bash
pnpm check
pnpm build:only
```

`build:only` 使用当前已同步内容，适合 UI 开发的快速构建验证。

### 7.2 完整发布检查

```bash
pnpm sync
pnpm check
pnpm check:edge
pnpm test:edge
pnpm build:only
git diff --check
git status --short
```

`pnpm build:only` 内含：

1. `astro build`；
2. Pagefind 索引生成；
3. `scripts/postbuild.ts` 私密值泄漏扫描。

任一步失败都不得部署。

## 8. 生产部署流程

### 8.1 当前权威流程

Cloudflare Dashboard 中生产与预览自动部署均为 Disabled。日常交付采用三段式 lifecycle：

1. `CI` 验证 PR；合入 `main` 后 exact-SHA main CI 再次验证；
2. `Publish Main Candidate` 从该 successful main CI 读取 committed `knowledge-public-v1` lock、验证并物化 immutable producer projection，再构建 immutable Pages artifact，并可选提升到 staging；
3. 手动 `Prepare Release` 创建/更新 Release PR；Release PR 合并后，新的 main CI + Candidate 触发 `Release Publish`，普通 main commit 则 safe no-op；
4. `Release Publish` 把 exact Candidate artifact 提升为 Published `vX.Y.Z`，不重新 build；
5. 手动 `Deploy Production(vX.Y.Z)` 选择 Published Release，验证 provenance 后进入 `production` Environment；
6. Production 仅刷新 release-pinned private bindings 并使用 Wrangler `--no-bundle` 上传已有 artifact；
7. 部署后执行公开/受保护 API smoke contracts 并记录 Cloudflare deployment identity。

因此：**Merge != Release，Release != Deploy，Deploy 不重新 Build 应用。** 完整 contract 见 `docs/delivery-lifecycle.md`。

### 8.2 紧急人工恢复

GitHub Actions 不可用且确需恢复生产时，才从具备完整私有输入和 Cloudflare 权限的
受信工作区运行：

```bash
pnpm deploy:cloudflare
```

如果已经执行并确认过完整构建，也可以只上传现有 `dist/`：

```bash
pnpm exec wrangler pages deploy dist \
  --project-name digital-biome \
  --branch main
```

只有在以下条件全部成立时才能复用现有 `dist/`：

- 构建后源码、knowledge projection lock、索引和 Secret 输入未变化；
- `postbuild` 已通过；
- `dist/_routes.json` 存在且只包含 `/api/private/*`；
- 当前分支和待发布提交明确。

### 8.3 发布证据

工作流 artifact 与 job summary 应保存：

- `git rev-parse HEAD`；
- `data-products/knowledge-public-v1.lock.json` 的 source revision、Release tag 与 digest；
- 当前 v3 Production/private-payload 路径额外记录 Personal Infrastructure RuntimeBinding revision、contract SHA-256 与 Release manifest identity；v1/v2 rollback 才记录历史 Thought Forest private source identity；
- 上游/物化索引生成时间或摘要；
- `PRIVATE_INFRASTRUCTURE_JSON` 的 schema version 和 key 数量，不记录值；
- 构建检查结果；
- Cloudflare deployment ID。

### 8.4 查看部署

```bash
pnpm exec wrangler pages deployment list --project-name digital-biome
```

确认最新一行同时满足：

- Environment 为 Production；
- Branch 为 `main`；
- Source 为预期提交；
- 没有 Failure。

## 9. Cloudflare Secrets 运维

生产必须只有以下应用密钥：

```text
CF_ACCESS_TEAM_DOMAIN
CF_ACCESS_AUD
PRIVATE_INFRASTRUCTURE_JSON
```

查看名称而不读取值：

```bash
pnpm exec wrangler pages secret list --project-name digital-biome
```

交互式设置单项 Secret：

```bash
pnpm exec wrangler pages secret put CF_ACCESS_TEAM_DOMAIN --project-name digital-biome
pnpm exec wrangler pages secret put CF_ACCESS_AUD --project-name digital-biome
pnpm exec wrangler pages secret put PRIVATE_INFRASTRUCTURE_JSON --project-name digital-biome
```

批量更新时使用未提交的 JSON 文件：

```bash
pnpm exec wrangler pages secret bulk tmp/access-secrets.json \
  --project-name digital-biome
```

安全要求：

- 不使用 `echo SECRET | ...`；
- 不把 secret 作为命令行参数；
- 不截图或复制完整 Access redirect URL；
- 临时文件必须位于被忽略的 `tmp/`，用完删除；
- Secret 更新后必须创建新部署并重新验收。

## 10. Cloudflare Access 运维

生产 Access Application 应只覆盖：

```text
bakersean.top/api/private/*
```

变更策略时检查：

- Allow Policy 只有预期身份；
- Application AUD 与 `CF_ACCESS_AUD` 一致；
- Team domain 与 `CF_ACCESS_TEAM_DOMAIN` 一致；
- 没有临时 Bypass、Everyone 或过宽的邮箱域规则；
- 策略变更后同时测试允许身份和未登录身份。

删除并重建 Access Application 会改变 AUD，必须同步轮换 Secret 并重新部署。

## 11. 生产验收

### 11.1 未登录验收

使用无 Cookie 的终端：

```bash
curl -I https://bakersean.top/
curl -I https://bakersean.top/api/private/session
curl -I https://bakersean.top/api/private/infrastructure
```

期望：

- 首页 `200`；
- 私有 API 被重定向到 Cloudflare Access，或由内层校验返回 `401`；
- 响应体不包含私有值。

对最新不可变 `pages.dev` 部署地址执行：

```bash
curl -I https://<deployment>.digital-biome.pages.dev/
curl -I https://<deployment>.digital-biome.pages.dev/api/private/session
```

期望首页 `200`，直连私有 API `401`。这一步证明即使绕过自定义域上的 Access，Functions 也会 fail closed。

### 11.2 已登录验收

用允许身份登录后：

1. 首页显示 Cloudflare Access 已认证状态；
2. `/api/private/session` 返回 `{ "authenticated": true }`；
3. `/infrastructure` 中私有字段和链接全部解锁；
4. 浏览器控制台没有 payload schema 或网络错误；
5. API 响应包含 `Cache-Control: private, no-store`。

验收记录只保存“字段数、链接数、成功/失败”，不要复制真实值。

### 11.3 静态产物验收

`postbuild` 是强制门禁，同时可人工抽查：

```bash
rg -n "ssh://|Cf-Access|PRIVATE_INFRASTRUCTURE" dist
```

`Cf-Access` 或公开代码名称本身不一定是泄漏；重点是完整 IP、凭据、SSH URL 和内部入口。人工扫描不能替代 `postbuild`。

## 12. 回滚

### 12.1 何时回滚

- 首页或核心路由大面积 5xx/404；
- 静态产物疑似泄漏；
- Functions 鉴权异常；
- 新 Secret 与页面 key 不一致；
- 新部署产生不可接受的内容缺失。

### 12.2 回滚步骤

1. 在 Cloudflare Pages → Deployments 找到最近一个已验收成功的 Production deployment；
2. 从该部署的操作菜单选择 **Rollback to this deployment**；
3. 立即执行未登录和已登录验收；
4. 如果问题涉及 Secret，恢复匹配旧部署的 Secret；
5. 在 Git 中修复并创建新的前向提交，不重写 `main` 历史。

回滚只切换部署产物，不自动回滚 Pages Secrets、Access Policy 或 GitHub 权限。这些控制面变更必须单独恢复。

## 13. 常见故障

### 13.1 历史部署记录出现 private submodule 错误

旧架构的 Cloudflare Git build 可能仍保留 `could not read Username` / `updating repository submodules` 日志。当前 Digital Biome 已移除 Thought Forest gitlink；不要为兼容历史日志重新引入 submodule 或公开 Vault。日常交付继续使用 GitHub Actions + Wrangler Direct Upload。

### 13.2 同步缺少上游 asset-index

症状：`merge-asset-index` 显示 upstream not found，或 `export:private` 直接失败。

处理：

1. public build：重新执行 `pnpm sync`，让 committed lock 的 producer artifact 被重新验证与物化；
2. Production/private workflow：确认 Release-pinned private checkout 已执行 `npm run kb:index`；
3. 本地私有联调：显式设置 `NOTES_VAULT_ROOT` / `NOTES_UPSTREAM_GENERATED`；
4. 重新同步、导出 payload 和构建。

生产部署不应接受关键 merge 步骤被跳过。

### 13.3 登录后仍未解锁

按顺序检查：

1. Access Application path 是否覆盖 `/api/private/*`；
2. `/api/private/session` 状态；
3. Functions 日志中的 `access_verification_failed`；
4. AUD 和 team domain；
5. `PRIVATE_INFRASTRUCTURE_JSON` schema；
6. 页面 `private_ref` 与 payload key 是否一致；
7. Secret 更新后是否创建了新部署。

### 13.4 `pages.dev` 私有 API 返回 401

这是预期的纵深防御结果。`pages.dev` 没有自定义域 Access Cookie/JWT 时，内层 Functions 应拒绝请求。

### 13.5 构建泄漏门禁失败

不要删除扫描规则或给值加编码来绕过。应定位来源并选择：

- 将内容标记为 private/internal；
- 扩展同步脱敏；
- 将值移入 `PRIVATE_INFRASTRUCTURE_JSON`；
- 删除不应发布的附件或生成物。

## 14. GitHub Actions 交付

权威 workflow 分工如下：

- `check.yml`：PR/main CI；
- `candidate-publish.yml`：successful exact-SHA main CI -> immutable Candidate；
- `release-please.yml`：显式 Release intent -> Release PR；
- `release-publish.yml`：Release commit Candidate -> Published immutable Release；
- `deploy-production.yml`：手动选择 Published `vX.Y.Z` -> Production promotion。

管理员首次启用时仍需在 GitHub 控制面完成：

1. 创建只具备 Contents Read 的 GitHub App，并只安装到 `digital-biome` 与 `thought-forest`；
2. 添加 repository variable `VAULT_APP_CLIENT_ID`；
3. 添加 repository secret `VAULT_APP_PRIVATE_KEY`；
4. 创建 `production` Environment，在套餐支持时启用 required reviewer 和禁止 self-review；
5. 在该 Environment 添加 `CLOUDFLARE_ACCOUNT_ID`、只有 Pages Edit 的 `CLOUDFLARE_API_TOKEN`，以及 `PRODUCTION_URL`；
6. 创建 `staging` Environment；在配置 staging Cloudflare 凭据前保持 repository variable `STAGING_DEPLOY_ENABLED=false`；
7. 允许 GitHub Actions 使用当前仓库的 `GITHUB_TOKEN` 创建 PR 与 dispatch workflow；
8. 保持 Cloudflare Git 自动 Production/Preview 构建关闭。

`.github/workflows/sync-knowledge-public-v1.yml` 是唯一的 Thought Forest public-projection consumer-sync authority：它只在 producer 的 immutable publication 成功后响应 dispatch，并在固定 automation branch/PR 中更新 `knowledge-public-v1` lock。读取 producer Release 使用只读 App token，写 Digital Biome PR 使用当前仓库 `GITHUB_TOKEN`；若 bot-authored PR 被仓库策略置为 `action_required`，workflow 仅批准自己生成的该固定分支 CI 并等待结果。当前 v3 Production 不检出 Thought Forest 私有 source；它按 Release provenance 验证 `knowledge-public-v1`，并以 production-scoped read-only deploy key 读取 Personal Infrastructure RuntimeBinding。Published Release 的 Pages artifact 不会重建；Cloudflare deployment URL/ID 作为独立 deployment record 保存。

## 15. 官方参考

- [Use Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Cloudflare Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Validate Cloudflare Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
