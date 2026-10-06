# 数据产品与发布接管记录

日期：2026-10-06。当前用户授权包含前端、接管中断的数据实施、合并和发版；本记录区分代码、CI、合并与生产。

## 已完成的代码

| 部分                           | 位置                            | 验证 / 状态                                                                  |
| ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| TUI / GUI 前端                 | Digital Biome PR #123           | 已合入 main `34fc428f`；完整门禁、16项浏览器回归、双轴复审通过               |
| Knowledge 通用消费             | PR #121                         | 已合入 main                                                                  |
| Infra immutable consumer       | PR #122                         | 包含在 `c604f81` 栈的双轴复审通过；CI受 App scope 阻塞                       |
| PDS materializer / prepare-all | PR #124                         | 同上；三份真实 Release 本地下载与物化通过                                    |
| Candidate / Release v5         | PR #125                         | 全三产品身份和独立私有绑定；27项交付测试、完整门禁通过；新 Production 不重建 |
| PDS producer                   | personal-digital-system PR #16  | `478d897`：48项测试、CI与双轴复审通过；待 consumer 协同激活                  |
| Infra producer                 | personal-infrastructure PR #112 | 既有 `55248d1` CI绿色；原作者已三轮审查；待 consumer 协同激活                |

不把“已经写完”当成统一链路已上线。尚未删除需要兼容或尚无替代运行证据的旧入口和凭据。

## 自动更新实现

`DATA_PRODUCT_AUTO_MERGE_ENABLED` 默认未设置，即关闭。启用后只接受来自 main 上既有同步 workflow 的 bot PR、精确 head、固定产品分支、唯一公共 lock 文件；校验完整文件清单、protected CI、required checks，并再次读取生产者 immutable Release。合并使用 expected SHA，不绕过 branch protection。由于 GitHub token 合并可能不触发 push CI，显式派发同一 protected main CI；Candidate、Release 与 Production 均校验该 CI 的 workflow path、main、SHA与成功状态。

`CONTENT_AUTO_DEPLOY_ENABLED` 同样默认关闭。新 `deploy-content.yml` 只接受成功的 exact Candidate，并验证其 source CI、manifest、archive。首先检查该 main commit 相对 first parent 只改公共锁；进入部署后再检查当前 Cloudflare production SHA 到 Candidate 的整个差异也是公共锁，阻止把未发布的应用代码夹带上线。main 发生变化、已部署、非前进更新或差异不符合要求时跳过。无法获得完整证据时失败。

内容和应用生产通道共用串行化组。内容部署使用独立 `production-content` Environment、同一不可变 archive 与 `--no-bundle`，不写 semver Release，不改私有 secret。上线前复验公开/私有引用覆盖；上线后验证公开页面和匿名私有 API 边界，记录完整 Candidate 和 Cloudflare部署 ID/URL。

## 当前外部阻塞

1. 现有 GitHub App installation `147359906` 尚未允许读取 `personal-infrastructure` / `personal-digital-system`。Infra CI重试仍在创建 token 时返回422，尚未进入测试。需要在 GitHub installation 设置扩展这两个仓库的既有只读安装范围，不能用更宽 PAT绕过。
2. 新自动内容环境尚未配置 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`PERSONAL_INFRASTRUCTURE_DEPLOY_KEY`。它们目前仅位于 application `production` 环境；GitHub不允许读取已有 secret 明文以跨环境复制。保持内容 kill switch 关闭，直到 owner通过私密输入或 GitHub设置完成该环境配置。

应用 production 现有凭据完整，不受第二项阻塞；仍受第一项及数据栈集成/CI约束。secret 值不进入仓库、文档或对话。

## 剩余顺序与验收

1. 数据栈最终代码审查、前端+数据联合完整门禁和浏览器回归。
2. App scope恢复后重新执行 exact-head CI，按 #122 → #124 → #125 → automation 的顺序合并；consumer就绪后合并 producer PR。
3. 关闭被新锁消费替代的旧 projection PR #120；先取得三个产品 event/reconciliation运行证据，再退休兼容入口。
4. 运行 main CI → Candidate → application Release → Production，记录 source / run / manifest / archive / deployment 身份并实测页面和Access边界。
5. 自动内容环境配置后，以开关关闭观察 → 开启 → 真实 lock-only更新证明自动上线；补 dropped-event恢复与回滚演练。

私有端点只在 producer RuntimeBinding更新、公共投影语义不变时不产生新的公共 Release；因此不触发静态 Candidate。直接修改 consumer private lock不进入自动内容通道。未来如需要独立自动私有绑定更新，须保留授权、覆盖校验和生产secret边界，不能混入本通道。
