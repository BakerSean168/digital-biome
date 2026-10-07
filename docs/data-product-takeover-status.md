# 数据产品与发布接管记录

日期：2026-10-06。当前用户授权包含前端、接管中断的数据实施、合并和发版；本记录区分代码、CI、合并与生产。

## 2026-10-07 配置恢复后的进展

用户确认并完成了既有GitHub App的仓库安装范围配置。实际CI已成功创建read-only token，并从Thought Forest、Personal Infrastructure和Personal Digital System读取锁定的公开Release。

| 已合并部分 | main merge | 通过的精确head CI |
| --- | --- | --- |
| Infra消费 #122 | `41a29c5` | `37559195348` / `234b1f0` |
| PDS消费 #124 | `c42abd9` | `37559533229` / `056cc09` |
| v5发布身份 #125 | `fe7b120` | `37559899752` / `13fe0c3` |

旧的projection复制PR #120已关闭，由公开Release锁消费替代；新PDS Release `7e9033ac85afd1717d2ed095fd0dd0f9071c4739`的只读shadow验证通过，语义与当前锁不同，可用于后续真实自动更新验收。

自动通道 #126需合并并通过main CI后，先完成一次v5应用发布与生产验收，再启用公共锁自动合并和内容部署。两个开关目前仍为false。`production-content`需三项Secrets：Cloudflare账户ID、仅目标账户的Cloudflare Pages Edit token，以及Personal Infrastructure只读SSH Deploy Key。原production中的对应凭据可以复用；新环境只允许main，自动内容通道不设置必需人工审批。截至本次检查，环境secret清单仍为空，用户正在配置；不能据确认文字跳过实际部署验证。

下面保留2026-10-06的实施与交付证据。历史阻塞描述不覆盖本节较新的状态。

## 已完成的代码

| 部分                           | 位置                            | 验证 / 状态                                                                                   |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------- |
| TUI / GUI 前端                 | Digital Biome PR #123           | 已合入 main `34fc428f`；完整门禁、16项浏览器回归、双轴复审通过                                |
| Knowledge 通用消费             | PR #121                         | 已合入 main                                                                                   |
| Infra immutable consumer       | PR #122                         | 包含在 `c604f81` 栈的双轴复审通过；CI受 App scope 阻塞                                        |
| PDS materializer / prepare-all | PR #124                         | 同上；三份真实 Release 本地下载与物化通过                                                     |
| Candidate / Release v5         | PR #125                         | 全三产品身份和独立私有绑定；27项交付测试、完整门禁通过；新 Production 不重建                  |
| PDS producer                   | personal-digital-system PR #16  | `478d897`：48项测试、CI与双轴复审通过；待 consumer 协同激活                                   |
| Infra producer                 | personal-infrastructure PR #112 | `7403d04`：补 main/前进来源/串行化/有界历史守卫；49项测试及双轴复审通过；待 consumer 协同激活 |

不把“已经写完”当成统一链路已上线。尚未删除需要兼容或尚无替代运行证据的旧入口和凭据。

## 自动更新实现

`DATA_PRODUCT_AUTO_MERGE_ENABLED` 默认未设置，即关闭。启用后只接受来自 main 上既有同步 workflow 的 bot PR、精确 head、固定产品分支、唯一公共 lock 文件；校验完整文件清单、protected CI、required checks，并再次读取生产者 immutable Release。合并使用 expected SHA，不绕过 branch protection。由于 GitHub token 合并可能不触发 push CI，显式派发同一 protected main CI；Candidate、Release 与 Production 均校验该 CI 的 workflow path、main、SHA与成功状态。

`CONTENT_AUTO_DEPLOY_ENABLED` 同样默认关闭。新 `deploy-content.yml` 只接受成功的 exact Candidate，并验证其 source CI、manifest、archive。首先检查该 main commit 相对 first parent 只改公共锁；进入部署后再检查当前 Cloudflare production SHA 到 Candidate 的整个差异也是公共锁，阻止把未发布的应用代码夹带上线。main 发生变化、已部署、非前进更新或差异不符合要求时跳过。无法获得完整证据时失败。

内容和应用生产通道共用串行化组。内容部署使用独立 `production-content` Environment、同一不可变 archive 与 `--no-bundle`，不写 semver Release，不改私有 secret。上线前复验公开/私有引用覆盖；上线后验证公开页面和匿名私有 API 边界，记录完整 Candidate 和 Cloudflare部署 ID/URL。

## 2026-10-06 外部阻塞记录

1. 现有 GitHub App installation `147359906` 尚未允许读取 `personal-infrastructure` / `personal-digital-system`。Infra CI重试仍在创建 token 时返回422，尚未进入测试。需要在 GitHub installation 设置扩展这两个仓库的既有只读安装范围，不能用更宽 PAT绕过。
2. 新自动内容环境尚未配置 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`PERSONAL_INFRASTRUCTURE_DEPLOY_KEY`。它们目前仅位于 application `production` 环境；GitHub不允许读取已有 secret 明文以跨环境复制。保持内容 kill switch 关闭，直到 owner通过私密输入或 GitHub设置完成该环境配置。

应用 production 现有凭据完整，不受第二项阻塞；仍受第一项及数据栈集成/CI约束。secret 值不进入仓库、文档或对话。

## 剩余顺序与验收

1. 数据栈最终代码审查、前端+数据联合完整门禁和浏览器回归已完成；外部配置恢复后重跑精确 head 的 CI。
2. App scope恢复后重新执行 exact-head CI，按 #122 → #124 → #125 → automation 的顺序合并；consumer就绪后合并 producer PR。
3. 关闭被新锁消费替代的旧 projection PR #120；先取得三个产品 event/reconciliation运行证据，再退休兼容入口。
4. 运行 main CI → Candidate → application Release → Production，记录 source / run / manifest / archive / deployment 身份并实测页面和Access边界。
5. 自动内容环境配置后，以开关关闭观察 → 开启 → 真实 lock-only更新证明自动上线；补 dropped-event恢复与回滚演练。

私有端点只在 producer RuntimeBinding更新、公共投影语义不变时不产生新的公共 Release；因此不触发静态 Candidate。直接修改 consumer private lock不进入自动内容通道。未来如需要独立自动私有绑定更新，须保留授权、覆盖校验和生产secret边界，不能混入本通道。

## 联合验证与复审

- 前端 main 与完整数据栈在隔离 integration worktree 无冲突合并。
- 三份 committed public locks 重新下载和物化后，`pnpm verify:full`通过；34项edge、129项unit、218项脚本测试通过，无跳过（装载了精确私有binding）。
- 独立3项真实私有引用覆盖通过；16项生产构建Chromium回归通过。Tools83.0KiB/gzip13.7KiB，JS61.1KiB，CSS128.9KiB，未放宽预算。
- v5代码 `c604f81` 双轴审查通过。自动通道最终代码 `ae2daba` 双轴复审通过；补齐下载/解压/内存上限，以及smoke失败后保留已完成部署的身份与结果。
- PDS producer最终代码 `478d897` 双轴复审及48项测试、GitHub CI通过；补齐20页限制与POSIX文件写入上限。
- `production-content`环境已建立，分支策略只允许main，无required reviewer；凭据未配置。两个自动开关显式设置为false。
- 0.8.0 application Release准备PR #127已通过CI；发布与生产结果单独记录，不能由上述本地结果推定。

## 前端 application 0.8.0 已部署；最终验收发现路由缺陷

数据App scope阻塞期间，已完成的前端独立走既有稳定 application 发布通道：PR #123 与 Release PR #127 已合并。

- Source: `7ed9597fc1e64c9447a1564a04435e71afa369d5`。
- main CI: `37518825666`；Candidate: `37519276544`；Release publish: `37519783594`。
- Release: `v0.8.0`，当前仍是 v4交付契约；尚未把待合并v5数据栈宣布上线。
- Production workflow: `37520002785`，成功。
- Pages deployment: `1b22db0e-697e-4103-8fc3-2a365fdfbb4b`。
- Public URL: `https://bakersean.top`。
- Archive: `sha256:6049d9d16a05317a0007eaf5b81971dee6976d58b9c2f213f7480357abfe0fee`，66,229,325 bytes。已下载比对Release manifest与部署记录，部署过程中没有重建。

Production workflow已通过页面、telemetry API和未登录私有API边界smoke。真实登录后的用户交互不以模拟测试代替。


## 生产验收后的修复与栈同步

v0.8.0 最终公网浏览器测试为14通过/2失败，不能把初步smoke成功当成完整交付：Search测试未兼容Cloudflare尾斜杠；公开笔记真实返回404。archive中HTML存在，根因是Candidate用Wrangler的宽泛路由规则覆盖postbuild精确规则。修复详见 `docs/pages-routing-incident.md`。

- 修复PR #128已合并 `10b3001`，真实Wrangler打包回归先红后绿；完整本地门禁通过，真实Pages Worker环境16项浏览器测试通过；双轴复审通过。
- Release PR #129已合并，0.8.1 source `f7e432c0bd39efbdf4599da4dbcda6746bdbc0c1`；已完成发布与部署，完整证据如下。
- main的前端及路由修复已顺序同步进全部数据PR，无冲突：#122 `b0ebe3c` → #124 `8d6fbc3` → #125 `0ae3d46` → #126 `48b9759`。
- #126新增自动内容部署公开详情smoke；26项相关测试及quality通过，双轴复审通过。旧脚本在“目录正常/私有401/详情404”场景中误判成功，回归已复现并修复。
- 联合集成分支也已纳入修复。后续合并不能恢复Wrangler自动路由覆盖行为。
- #122新head CI `37523332853`仍在创建App token时422，未进入测试；`production-content` secrets查询仍为空。两个自动开关继续关闭。


## 0.8.1 已验证交付

- main CI `37523871537` → Candidate/staging `37524412073` → Release publish `37524858587` → Production `37525004208`，全部成功。
- Source `f7e432c0bd39efbdf4599da4dbcda6746bdbc0c1`；archive SHA-256 `73866b87f4f1e6456fa3f212fbdecfec2ac5e0b127a4bce4ce6bd79e568c7105`，66,225,857 bytes；Release manifest SHA-256 `48068b4ed4d3c183bc19fe544a515fe3dac3308973433144433dfc3e69b7cd25`。
- Cloudflare deployment `b2d70583-a0f8-4b12-aa41-965ee76872a9`，URL `https://b2d70583.digital-biome.pages.dev`；公开域名 `https://bakersean.top`。
- 分别下载Candidate/Release archive比对身份，并逐字段比对deployment record；公开笔记200，底栏v0.8.1/f7e432c0，生产16项Chromium回归全部通过。
- 应用继续使用既有v4发布契约。数据栈仍等待上述App安装范围和content环境secret配置，未合并启用。授权浏览器场景中的模拟响应不代替真实登录或手机软键盘验收。
