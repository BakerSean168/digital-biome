# ADR-0001：私有 Vault、GitHub Actions 与 Cloudflare Pages 直接部署

- 状态：Accepted
- 日期：2026-07-18
- 决策范围：内容供应链、Cloudflare Pages 发布方式、GitHub App 权限

## 背景

Digital Biome 的内容源 `thought-forest` 包含原始知识笔记和基础设施资料。即使公开投影已经脱敏，原始仓库仍含不应匿名访问的 IP、SSH URL 和内部入口，因此必须保持私有。

Cloudflare Pages 项目最初通过 GitHub 集成自动构建。主仓库 `digital-biome` 可以正常克隆，但 `thought-forest` 变为私有后，Cloudflare 的子模块更新阶段无法获取该仓库凭据。

已实际尝试：

1. 将 Cloudflare Workers and Pages GitHub App 权限限制到 `digital-biome` 和 `thought-forest`；
2. 保存并刷新 GitHub App 安装权限；
3. 多次重试同一生产构建。

每次仍失败于私有 submodule clone，错误为无法从 GitHub 读取用户名/凭据。

## 决策

1. `thought-forest` 保持私有；
2. Cloudflare Pages 的 Production 和 Preview 自动部署关闭；
3. GitHub Actions 使用仅 Contents Read、且只安装到 `digital-biome` 与 `thought-forest` 的 GitHub App 短期令牌检出私有子模块；
4. build job 固定主仓库 SHA、Vault SHA 与索引 hash，完成同步、构建、测试和泄漏扫描；
5. deploy job 必须通过 `production` Environment 人工审批；
6. Wrangler 将已审查的 `dist/`、Functions bundle 和 `_routes.json` 直接部署到现有 Pages 项目；
7. Cloudflare API token 仅授予目标账户 Pages Write；
8. 发布完成必须执行外层 Access、内层 JWT 校验和公开/受保护接口冒烟测试。

## 原因

- 隐私优先于自动构建便利性；
- 直接部署已由生产验收证明可用；
- Cloudflare 官方允许 Git 集成项目关闭自动构建后继续使用 Wrangler 部署；
- 不引入长期 token 到 `.gitmodules`、构建脚本或公开配置；
- 不为解决 CI 问题复制或公开原始 vault。

## 正面影响

- 原始 vault 不再匿名暴露；
- Cloudflare 不需要读取私有子模块；
- 不再产生已知必失败的自动部署；
- 发布不再依赖维护者电脑或本地 Wrangler 登录态；
- 每次发布保存两个仓库 SHA、索引 hash、artifact 和 Cloudflare deployment ID；
- GitHub App 权限遵循最小授权。

## 负面影响

- 发布依赖 GitHub Actions、GitHub App、Environment 和 Cloudflare API token 四个控制面；
- `git push main` 只触发构建，仍需人工批准生产部署；
- 缺少自动 Preview deployment；
- 单维护者允许 self-review，审批门禁主要防止无意部署而非职责分离；
- GitHub Actions 故障时需使用保留的本地紧急恢复流程。

## 被拒绝的方案

### 重新公开 `thought-forest`

拒绝。它会重新暴露原始敏感内容，与系统隐私目标冲突。

### 将 GitHub token 写入 submodule URL

拒绝。token 可能进入 `.gitmodules`、日志、进程参数或错误输出，且生命周期难以管理。

### 将全部生成内容提交到 `digital-biome`

暂不采用。它会扩大公开仓库的数据面，并增加误提交私有内容的风险。只有建立严格的公开 artifact 签名和泄漏门禁后才可重新评估。

### 继续无条件重试 Cloudflare Git 构建

拒绝。权限刷新后的实测结果没有变化，继续重试只会产生噪音和失败状态。

## 紧急恢复

GitHub Actions 不可用时，允许从具备完整私有输入和 Cloudflare 权限的受信工作区运行
`pnpm deploy:cloudflare`。该路径只用于恢复，不是日常发布入口；仍需执行同等检查、
泄漏扫描、Secret 一致性校验和冒烟测试。

## 重新评估条件

满足任一条件时重新审查本 ADR：

- Cloudflare 官方明确支持并验证了跨私有仓库 submodule 凭据传递；
- 内容供应链改为版本化私有 artifact/package，不再使用 Git submodule；
- GitHub Actions 或 Cloudflare Pages Direct Upload 的权限模型发生重大变化；
- 站点变为多维护者，需要启用禁止 self-review 和职责分离。

## 验证证据

决策落地时已验证：

- 自定义域公开页面返回 `200`；
- 未登录私有 API 进入 Cloudflare Access；
- 直连不可变 `pages.dev` 私有 API 返回 `401`；
- 允许身份登录后全部私有字段与链接解锁；
- Pages 生产只保留新的 Access/payload Secrets；
- Wrangler 部署对应已推送的 `main` 提交。

## 参考

- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Use Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
