# 前端生产交付与统一数据链交接

日期：2026-10-06。前端已合并、发布并通过生产验收；新统一数据链已实现与集成验证，尚因外部配置阻塞而未合并上线。

## 当前可用版本

- GUI：<https://bakersean.top/?ui=gui>
- TUI：<https://bakersean.top/?ui=tui>
- Release：<https://github.com/BakerSean168/digital-biome/releases/tag/v0.8.1>

两种模式共用路由、数据、搜索、筛选、选中对象和权限。有效 `ui` URL 参数是临时覆盖；手动选择保存本地偏好并移除覆盖，保留其他查询和锚点。详细行为见 `17-ui-mode-state-contract.md` 和 `21-dual-ui-code-delivery.md`。

Home、About、Tools、Library/Notes、Blog、Projects、Friends、阅读与详情、Systems、Infrastructure、Access、404 均使用共同的模式壳。Notes 与 Blog 保持独立内容语义；既有 `/projects` 和 `/dev` 职责没有被默默合并。外部服务新标签打开，私有链接只从授权接口解析。

## 不可变发布证据

| 项目 | 身份 |
| --- | --- |
| 前端 PR | #123，合并 `34fc428f3dc407f6bcf5e9aec29c669f241ffd71` |
| 路由打包修复 PR | #128，合并 `10b3001dab9d85731f01c57065bcc4a334ba0b1a` |
| Release PR | #129 |
| 发布 source SHA | `f7e432c0bd39efbdf4599da4dbcda6746bdbc0c1` |
| main CI | `37523871537`，成功 |
| Candidate / staging | `37524412073`，成功 |
| Release publish | `37524858587`，成功 |
| Production | `37525004208`，成功 |
| Cloudflare deployment | `b2d70583-a0f8-4b12-aa41-965ee76872a9` |
| deployment URL | <https://b2d70583.digital-biome.pages.dev> |
| archive SHA-256 | `73866b87f4f1e6456fa3f212fbdecfec2ac5e0b127a4bce4ce6bd79e568c7105` |
| archive bytes | `66225857` |
| release manifest SHA-256 | `48068b4ed4d3c183bc19fe544a515fe3dac3308973433144433dfc3e69b7cd25` |

已分别下载 Candidate 和 Release archive 核对 digest，并逐字段核对 Release manifest 与 deployment record。Production 部署同一 archive，没有重建。当前发布仍采用既有 `digital-biome.release/v4` 契约，待合并的 v5 数据链没有被宣布上线。

## 最终验收

- 本地完整门禁通过；补丁的最终 Astro check 为0 errors、0 warnings、3项既有兼容性 hints。20项针对性打包/路由/workflow回归通过，双轴审查通过。
- 包含真实 Worker 的本地 Pages 环境：16项浏览器回归通过。
- 实际生产 `https://bakersean.top`：16项浏览器回归通过，包含模式及历史状态、真实搜索、筛选、阅读锚点、手机详情、固定底栏和内部滚动。
- 生产底栏显示 `v0.8.1 · f7e432c0`；`/notes/obsidian/typescript-utility-types/?ui=gui` 返回200，阅读和目录跳转通过。
- Production workflow 的真实公开笔记、telemetry 与匿名私有 API 边界检查通过。浏览器中的私有链接解锁场景使用明确模拟响应，不代表已经代替用户完成真实登录验收；真实手机软键盘仍需设备验收。
- 本地前端门禁有1项缺少真实 private binding 的覆盖测试跳过；独立完整数据集成 worktree 装载精确 binding 后，该覆盖及全套验证通过，没有将跳过冒称通过。

v0.8.0 最终验收曾出现14通过/2失败。公开笔记404是真实打包缺陷：Wrangler自动路由覆盖postbuild精确规则；另一项是Search测试未兼容Cloudflare的末尾斜杠。修复过程及先红后绿证据见 `../pages-routing-incident.md`。旧Release资产没有被改写。

本地证据位于 `.artifacts/release-v0.8.1/` 和 `.artifacts/route-fix/`；这些诊断材料不作为应用发布资产。

## 数据重构已接管的范围

| 部分 | PR / 最后核对的代码 |
| --- | --- |
| Infra immutable consumer | Digital Biome #122，`b0ebe3c` |
| PDS catalog / prepare-all | Digital Biome #124，`8d6fbc3` |
| 三份公共锁与独立私有绑定的 v5 发布身份 | Digital Biome #125，`0ae3d46` |
| 验证后自动合并公共锁、内容部署 | Digital Biome #126，代码 `48b9759` |
| PDS producer Protocol v1 | personal-digital-system #16，`478d897` |
| Infra producer Protocol v1 | personal-infrastructure #112，`7403d04` |

旧工作中的来源前进校验、串行发布、传输/历史上限、真实私有引用覆盖及发布身份缺口已补齐。两端producer测试和CI通过；消费者/v5/自动通道双轴复审通过。前端与完整数据栈联合物化三份真实公共Release、运行完整门禁和16项浏览器测试通过，性能预算未上调。最新路由修复已顺序同步进数据PR，并完成联合打包回归；自动内容部署新增详情404回归也通过。

这些证据证明代码和本地集成就绪，不能代替以下外部启用条件。

## 仍需配置的两项

1. 在现有 [GitHub App installation](https://github.com/settings/installations/147359906) 中允许读取 `personal-infrastructure` 和 `personal-digital-system`。#122 的最新CI `37523332853` 在创建token时仍返回422“repository not accessible”，尚未进入测试。不能绕过此检查合并消费栈。
2. 在 `production-content` Environment 配置 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`PERSONAL_INFRASTRUCTURE_DEPLOY_KEY`。该环境已创建、只允许main，但secret清单仍为空；GitHub不会提供现有production secret明文用于复制。通过私密渠道配置，不在聊天或文档粘贴值。

`DATA_PRODUCT_AUTO_MERGE_ENABLED=false`、`CONTENT_AUTO_DEPLOY_ENABLED=false` 保持关闭。已有application生产环境完整，因此前端0.8.1能够独立发布。

配置完成后的顺序：重新验证精确head CI → 按 #122 → #124 → #125 → #126 合并 → 协同合并producer #16/#112 → 用新v5契约完成一次真实应用发布 → 再开启并证明一次公共锁更新自动上线。旧projection PR #120应在新消费路径激活后关闭，不能混入当前栈。尚未执行的自动内容上线、事件丢失恢复和回滚演练继续作为待验收项。
