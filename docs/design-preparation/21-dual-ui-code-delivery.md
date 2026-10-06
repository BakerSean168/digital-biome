# TUI / GUI 代码实施与交付

日期：2026-10-06。实现分支 `feat/dual-ui`，集成起点 `f37007d`。本文件记录实现与验证，合并、候选、生产发布分别记录，不能互相替代。

## 产品与页面

- Home：身份、Library / Projects / Tools 导航、分开的 Blog / Notes 与少量常用服务。
- About：连续阅读、个人实践与生态关系旁注。
- Tools：Services / External / Hosts / Network，共用真实目录；文本输入和筛选按钮在同一行。
- Library：Notes 与 Blog 保持各自内容及路由，标签目录独立。
- Projects、Friends：共用对象列表、详情预览与直接动作。
- 阅读、项目详情、Systems、Infrastructure、Access、404：使用同一模式壳和颜色。项目详情改为连续正文及入口侧栏，去除旧版大圆角与空监控占位。

基础设施拓扑与系统关系页继续使用来源已验证的事实视图，不从显示名称推导新的资产关系。`/projects/[assetId]` 和 `/dev/[assetId]` 沿用当前代码的既有职责，本次不擅自统一历史路由。

## 状态与组件所有权

| 状态 / 事实                | 所有者                                | 实现                                             |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| 公开知识、项目、资源       | 既有 repository / producer projection | `terminal-repository` 仅投影展示对象             |
| 路由与主导航               | `navigation-policy`                   | Home / Library / Projects / Tools / About        |
| UI mode                    | `domain/ui-mode`                      | 有效 URL 覆盖 > localStorage > TUI               |
| 查询、条件、选择、加载数量 | 一个 ObjectBrowser                    | 两种模式共用 DOM 和事件                          |
| 返回与刷新恢复             | 当前 history entry                    | `biomeBrowsers[contextPath]` 仅保存查询及公开 ID |
| Access / 私有地址          | Cloudflare Functions                  | 授权响应经校验后只写入 DOM                       |
| 页面滚动                   | `#site-content`                       | 固定 viewport 与底栏，内容内部滚动               |
| 版本                       | package version + 构建 Git SHA        | 本地未提交状态明确显示 worktree                  |

模式切换不重新请求目录、不清空文本与筛选、不重置对象 ID。手动选择写入本地偏好并移除临时 `ui` 参数；存储不可用时以 URL 保存选择。站内内容链接延续临时模式，API / auth 接口与外部地址不附加 `ui`。阅读模式切换以可见正文锚点保持阅读位置。

TUI 保留 `1–4` Tab、`i` 输入、`f` 筛选、`j/k` 选择、`g` 跳转、`r` 关联、`u` 返回及动态路径。GUI 以文本与点击为主，不暴露整排快捷键提示。

## 有界数据与权限

Notes 首屏12条、External 首屏16条，较大的服务目录首屏12条；加载更多、查询或筛选才拉取完整 catalog。两种模式不各自输出全量列表。目录失败与空结果分开，失败时不能打开基于不完整数据的筛选弹窗。

私有链接通过 `privateRef` 和既有 `/api/private/infrastructure` 解析；懒加载新行后复用校验过的响应。无认证时仍保留 Access，禁止将真实私有 URL 放进公开 catalog、localStorage 或 history state。外部服务与正文外链默认新标签打开。

筛选在同组内 OR、跨组 AND；弹窗草稿可取消，确认才应用。Notes 的 q/tag 保持可分享，切换模式不破坏查询和 hash。

## Figma 对照

Home、About 和 Tools 对照已读回的原生 Figma GUI NEXT 及截图。其余页面扩展同一排版和共享状态。Figma 当前电脑连接不可用时，使用已保存的完整节点树和设计证据继续实施，没有覆盖 CURRENT / LEGACY，也没有把截图当作页面实现。

## 验证记录

本地已使用 committed locks 重新执行 `pnpm sync`，物化知识与基础设施数据。基础门禁包括 quality、Astro、edge、unit、infrastructure、生产构建、Pagefind、泄漏检查和性能预算。

浏览器验收使用生产构建，包含 SSR 边界、延迟目录加载、q/tag、真实 Pagefind、临时与持久 UI 模式、模式切换保留选择与筛选、历史返回、失败重试、取消草稿、手机详情、主要路由内部滚动、阅读锚点与目录高亮。私有绑定浏览器测试使用明确的模拟响应，仅证明前端处理，不能代替真实 Access 环境验收。

最终命令结果、CI head、候选与生产身份将在交付时补录。当前文档不将本地预览或模拟授权声明为生产发布成功。

## 数据构建集成边界

同期数据建模工作位于独立 worktree。Knowledge 已进入 main；Infra consumer PR #122 和本地 PDS consumer 提交属于另一条集成线。现有前端只读取既有 adapter，不写 producer schema、不修改消费锁来掩盖缺失数据。

Infra PR 的 GitHub App read scope 阻塞、PDS consumer 未提交 PR，以及后续 provenance / production revalidation 必须单独核对。合并数据实现后重跑完整门禁和浏览器测试；不以其他 agent 的文字完成声明代替 CI 和生产证据。

## 本地验收完成记录

- `pnpm sync`：通过，两份 committed public locks 重新验证并物化。
- `pnpm verify:full`：通过；Astro 0 errors/warnings/hints，edge / unit / infrastructure suites 通过；1 项既有 private RuntimeBinding coverage 因本地未装载真实 binding 而跳过，未冒称通过。
- 生产构建：3,766 页面；Pagefind 生成及 runtime pruning、postbuild 泄漏边界通过。
- 性能：Notes HTML 30.8 KiB，Tools HTML 82.8 KiB / gzip 13.6 KiB；JS 60.7 KiB；CSS 129.1 KiB。既有页面限额未上调。
- Chromium：11 项 E2E 全通过，覆盖桌面及 390×844 手机；额外40个页面/模式/视口截图巡检没有 JS pageerror。巡检发现的 Infrastructure 表格横向溢出、项目详情空白、阅读网格百分比加 gap 溢出已修复并加入针对性验收。
- 阅读目录已改为内容滚动容器驱动，模式参数、锚点跳转和模式切换均经过实际浏览器测试。
- 站点 canonical 默认值改为当前 production 环境登记的 `https://bakersean.top`；不再输出模板 `yourdomain.com`。
- 预览 host 仅在显式设置 `BIOME_PREVIEW_HOST` 时加入允许列表；没有放开任意 Host。

本地证据在 `.artifacts/dual-ui/`，不作为发布产物。真实发布身份仍需经 PR/CI/Candidate/Production 顺序记录。

## 双轴审查修复

审查基线：`f37007d...848189a`。

**规范轴**：Search 关闭按钮 Enter 被拦截、Tools 的 Ctrl/Cmd 点击被拦截、对象标签叶名称缺少完整路径提示。分别限定 Search 输入键盘处理范围、保留修改键的原生链接行为、为静态及动态标签增加完整路径 title。

**规格轴**：输入法确认被当成快捷键、About GUI 缺少完整内容、About 的两份布局无法直接复用 DOM 阅读锚点。分别忽略 composing/229 键事件、共用完整内容目录、以具名语义锚点映射两种文章布局，并按内容容器相对位置恢复。

修复后 Chromium 扩展为 **16项全部通过**：新增输入法与关闭按钮、修改键不拦截、手机 About 双向阅读位置验收。浏览器自动化不能模拟真实手机软键盘，此项仍需设备验收，未声称已覆盖。

最终 About 回归包含定义列表内部阅读位置，以及短布局触及滚动底部时的自然边界：尽量保持锚点偏移，无法继续滚动时保持章节可见，不添加人为留白。
