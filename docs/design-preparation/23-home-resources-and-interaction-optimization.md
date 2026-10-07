# Digital Biome 首页资源与交互优化方案

日期：2026-10-07。状态：审查基线与分批实施记录；A/B/D/E 本地验收完成，C 本地源端与消费链路通过；producer 发布与数据锁迁移尚未完成。

> 实施记录（2026-10-07）：用户已要求开始实施。首批交付 A/B，并将共用的即时导航反馈一并接入。以下审查正文保留为实施前基线；完成证据在本节更新。
>
> 约束：复用 ObjectBrowser、navigation-policy、UI 模式与公开目录解析器；SSR 12/16 条边界不变。仅当前可见 Tools 目录可自动补齐，Notes 完整目录仍按明确操作加载。历史数据先验证，异步结果必须匹配当前浏览意图；失败保留已有行与位置。用浏览器行为回归覆盖命令、布局、加载和恢复，再执行数据锁物化与完整门禁。C 的发布迁移独立验收；用户已确认 E 统一复用现有 favicon。

Digital Biome 应同时帮助访客理解个人数字生态、帮助站点主人快速使用资源。本轮优化的重点是：让首页展示有解释力的代表性系统，让资源顺序由源数据控制，让键盘操作从输入到导航、浏览、继续加载都有明确反馈。

审查基线为本地 `a1bc528`，线上底栏为 `v0.9.0 · a1bc528c`。桌面证据来自本次对 `https://bakersean.top/` 的实际操作；用户提供的三张截图作为问题背景。历史设计文档仅用于理解约束，不作为当前部署证据。

配套材料：[交互式审查摘要](evidence/2026-10-07-product-audit/review.html) · [测量记录与截图校验值](evidence/2026-10-07-product-audit/observations.json)。

## 1 对五项反馈的判断

| 用户观察 | 核对结果 | 推荐决策 |
| --- | --- | --- |
| 首页常用可能写死，不能方便调整 | 名称和入选标记来自投影；前端固定了筛选、标题排序、最多八项及“常用”文案 | 分开“首页精选”和“使用优先级”，配置保留在数据拥有者处 |
| 跳转前没有反馈，随后突然换页 | 当前快捷键使用 `location.href`，没有导航反馈，也没有 Astro ClientRouter | 先提供即时状态，再加短促页面过渡；分别优化等待感和实际耗时 |
| 按 g 后不知道是否进入命令组 | 已复现；代码仅保存前缀和时间戳，默认窗口 1200 ms，没有提示 | 显示已输入前缀、合法后续键、取消和超时状态 |
| 默认 12 条偏少，顶部随内容滚动，JK 到底无法继续 | Services 是 12 条，External 是 16 条；追加后父容器滚动，双击 J 不加载 | 桌面固定工具栏，列表独立滚动，按可用高度补齐首屏，接入键盘加载 |
| Logo 像默认图标 | 首页为 `biome-mark.svg`，底栏为 Lucide `Network`，favicon 又是另一套树形图 | 统一到已确认的 Digital Biome 品牌资源；不把探索稿当作定稿 |

两点术语修正：框架名是 **Astro**；“Soft Forest”按本仓库实际数据源理解为 **Thought Forest**。当前页面是构建时生成的静态 HTML，不能将等待直接归因为服务端实时渲染。服务资源目前来自 **Personal Infrastructure**，并非所有资源都来自 Thought Forest。

## 2 桌面审查证据

本次主流程使用 1600 × 1000 CSS 像素、TUI 模式、匿名访问。页面上有约 29.5 px 高的资源行。截图原件与本文件一起保存；下列步骤同时记录可用之处和缺口。

### 步骤 1 首页发现资源

整体状态：导航和内容入口可用，首页策展不足。

![首页的常用链接与最近内容](evidence/2026-10-07-product-audit/01-home.png)

首页能清楚区分 Library、Projects、Tools、About，也明确标注 Access。但“常用”只有名称，访客难以理解 Hermes、Homepage、LiteLLM 的用途。首页同时承担个人快捷入口和对外介绍，当前这一区域没有表达后者。

### 步骤 2 输入 g 等待后续命令

整体状态：组合键逻辑存在，状态不可见。

![按下 g 后页面没有出现命令组提示](evidence/2026-10-07-product-audit/02-go-pending.png)

输入 `g` 后的截图没有后续候选键、倒计时或取消提示。随后 `g → t` 成功跳转到 Tools。单次 Navigation Timing 记录为 TTFB 约 138 ms、响应传输约 7 ms、DOMContentLoaded 约 811 ms；这些是同一次导航的不同阶段，不能相加，也不等同于用户感知的一秒延迟或绘制耗时。没有重复采样、网络限速及完整性能 trace，不能据此定位耗时主因。

### 步骤 3 Services 首屏浏览

整体状态：选择和预览可用，空间利用不足。

![Services 初始只展示十二项](evidence/2026-10-07-product-audit/03-services-initial.png)

显示 `12 / 22`，列表从 y≈149 到 y≈503，底栏上沿在 y≈939，尚有明显可用高度。此视口下，22 条服务本可在接近一个可视区域内展示。Tab、说明、筛选分别占行；宽屏右侧未用于组织这些控制项。

### 步骤 4 External 加载更多

整体状态：追加成功，加载过程表达不足。

![External 追加后显示四十项](evidence/2026-10-07-product-audit/04-external-loaded.png)

External 从 `16 / 395` 变为 `40 / 395`。首次请求 `/data/terminal/external.json`，本次传输压缩体积约 34.9 kB，耗时约 559 ms。它下载完整目录，再分批创建行；这里的“加载更多”并不等于请求下一页数据。当前按钮会禁用，但没有明确的“正在加载”文案。

### 步骤 5 长列表向下滚动

整体状态：底栏和右侧预览保持可达，顶部控制丢失。

![滚动后 Tab 和筛选栏已离开视口](evidence/2026-10-07-product-audit/05-external-scrolled.png)

追加 40 条后，列表高 1180 px，桌面 `overflow-y: visible`；滚动的是 `#site-content`。父容器滚动 494 px 后，Tab 顶部 y≈−470，筛选栏 y≈−383。用户要切类型或改过滤条件，就要回滚或记住快捷键。

### 步骤 6 在最后一项连续按 J

整体状态：选择能到达最后一项，继续浏览中断。

![最后一项选中但连续按 J 后仍需操作加载更多](evidence/2026-10-07-product-audit/06-keyboard-boundary.png)

选中第 40 项后连续按两次 `j`，仍为 `40 / 395`，选择停在 Bitget Wallet Card。当前选择逻辑将索引限制在已渲染范围内。严格说，“只有鼠标能加载”不完全准确：原生 button 可用 Tab 聚焦后按 Enter/Space；缺的是 JK 浏览与继续加载之间的连续操作。

### 证据边界

桌面审查期间协作浏览器断开，因此未完成移动端、真实软键盘、减弱动画、屏幕阅读器、故障注入、跨浏览器及 `g → Esc` 的最终实测。取消命令、状态恢复等下文部分判断来自代码阅读，已分别标注。截图不能证明整体无障碍合规，也不能证明受保护服务已成功登录或健康可用。

## 3 首页改为代表性系统展示

### 3.1 首页要回答什么

访客首先需要知道“这是什么、为什么有特点、可以看到什么”；主人需要快速进入服务。建议用“精选系统”作为该区域标题，每项展示 **名称、一句话用途、访问方式**。保留克制的文字与细线边界，沿用 Basalt & Moss，不引入大卡片、光晕或循环装饰动画。

首页保留以下五个对象，顺序是建议初值，最终由配置决定：

| 建议顺序 | 显示名称 | 建议的一句话用途 | 访问表达 |
| --- | --- | --- | --- |
| 10 | 哪吒面板 | 查看服务器资源与探针状态 | 公开入口 |
| 20 | MemoFlow | 个人日常管理产品 | 公开入口，文案与项目来源核对 |
| 30 | Homepage | 家庭网络的服务导航 | 需登录 |
| 40 | LiteLLM | 统一模型调用与提供方管理 | 需登录 |
| 50 | Hermes | 个人 Agent 会话与持续任务 | 需登录 |

“LightLLM”暂按截图中的 **LiteLLM** 理解；若用户实际指另一个推理项目，不应自动替换资源身份。“DailyUse / Memoflow”属于服务标题，“MemoFlow”属于产品表达，可用展示名称改善文案，不能通过改名字制造第二个资产。Personal Twin 本轮不进入首页精选，原资源仍可在 Tools 找到。

五项在大屏可用两列的紧凑条目布局，小屏单列；不要为了强行一行排完而隐藏用途。提供“全部服务”入口。受保护对象可以先查看公开介绍，再选择登录访问；不要让所有访客理解一个项目的唯一路径都是登录。

### 3.2 入选规则

首页精选是人工策展结果，使用优先级是导航排序信号，两者独立：LinuxDo、bilibili、YouTube 可以都很常用，却不因此自动成为首页精选。

推荐规则为：对象存在于公开投影 → 允许在首页展示 → 被明确标为精选 → 按首页顺序排列。生命周期变化需要显式处理：运行服务默认只展示 active；若以后展示归档项目，应该以“作品”语义表达。不要以名字匹配或自动热门替代明确选择。

无精选配置时隐藏该区域或显示普通“全部服务”入口；配置为空不应偷偷恢复旧六项。界面的数量上限属于展示策略，可以保留；对象名单和先后顺序必须来自数据。

## 4 配置数据归属与排序契约

### 4.1 当前链路

| 数据 | 当前事实拥有者与入口 | Digital Biome 消费路径 |
| --- | --- | --- |
| 外部资源名称、URL、描述 | Thought Forest 资源笔记 | knowledge-public-v1 → 物化与索引 → getBookmarks → terminalExternal |
| 服务、主机、网络、受保护引用 | Personal Infrastructure 的 inventory/public-infrastructure.yaml | infra-public-v2 → getInfrastructureResources → terminalInfrastructure |
| 首页常用服务 | 上述 inventory 的 portal-pinned 和 portal 类别标记 | getPortalServices → active 与类别过滤 → 标题排序 → pinned → 前八项 |
| 作品资产已有首页配置 | Thought Forest 资产 homepage.enabled/featured/order | 资产索引及资产查询；当前首页常用条目没有使用这条链 |

因此首页已经是“部分数据驱动”，缺少统一、显式的展示规则；并不是需要从零做一个 CMS。旧 `HOMEPAGE_FEATURED_BOOKMARK_SLUGS` 名单仍在书签 repository 中，但当前首页不调用它，不应误判为截图来源。后续确认无调用后可清理遗留入口。

### 4.2 建议字段

以下是待实现契约，不是已经可以直接填写并生效的现有功能。

| 字段 | 语义 | 推荐规则 |
| --- | --- | --- |
| usage_priority | 主人指定的资源使用优先级 | 可选正整数，越小越靠前，同值合法，缺省排在有值之后 |
| homepage.enabled | 是否允许进入首页候选范围 | 新配置必须明确为布尔值；缺省不入选 |
| homepage.featured | 是否进入精选系统区域 | 独立于 usage_priority |
| homepage.order | 精选内部顺序 | 小值优先，复用已有资产语义；旧值 0 必须兼容 |
| homepage.label | 首页显示名 | 可选，回退到对象原名 |
| homepage.description | 首页短用途说明 | 可选，回退到公开描述 |

`usage_priority` 是手工声明的优先级，不是系统统计的频率。不要为了实现这个字段增加访问追踪、帐号画像或自动点击计数。

Thought Forest 的三个资源笔记可各增加以下候选字段；不要复制资产的整套 homepage 字段到普通知识笔记：

```yaml
# LinuxDo、bilibili、YouTube 的资源笔记各自配置
usage_priority: 1
```

Personal Infrastructure 的服务记录可采用相同优先级语义，并扩展明确的首页展示字段，例如：

```yaml
# 建议加入既有 svc-litellm-model-gateway 记录的公开展示配置
usage_priority: 2
homepage:
  enabled: true
  featured: true
  order: 40
  label: LiteLLM
  description: 统一模型调用与提供方管理
```

源侧可以使用 snake_case，投影与 TypeScript 可以规范化为 `usagePriority`，但映射必须固定并经过验证。不要同时把 `frequency`、`weight`、`rank` 做成同义字段。资源普通笔记扩展应同步修改 Thought Forest 元数据规范；现有规范明确将资产字段与普通笔记分开。

首轮建议按事实拥有者配置：外部资源与作品在 Thought Forest，运行服务在 Personal Infrastructure。这样无需复制服务 URL、状态或宿主到另一个库。若后续要求在 Obsidian 统一编辑首页所有对象，可增加只引用稳定资源 ID 的策展笔记；那应作为唯一首页策展源迁移过去，不能与各处 homepage 配置同时竞争。当前不必先建第四个数据产品或独立管理后台。

### 4.3 排序规则

资源默认排序按以下顺序执行：

1. 先执行公开可见性、资源类型和当前筛选条件；优先级不得扩大可见范围。
2. 有合法 usage_priority 的对象优先；按数值升序。
3. 同优先级或都未配置时，按显示名称使用显式固定 locale 与数字排序规则。
4. 名称仍相同时按稳定 ID 排序，确保构建、首屏和后续目录结果一致。

`1, 1, 2, 未配置` 是合法顺序。首批三个常用网站同为 1，将一起位于未配置资源之前；若需要三者内部固定先后，再分别设为 1、2、3。优先级无需连续，也不是数组下标。空值作为未配置；负数、0、小数、字符串、布尔值及非有限数应在新优先级契约中报错，不靠 JS 隐式转换。

界面默认显示“排序：优先级”，允许切换“名称”。当前列表文本查询是包含匹配，匹配子集保留上述顺序即可；全站 Pagefind 搜索继续以相关性为主，不能让高优先级但不相关的项目挤走答案。Notes 的“最近更新”和 Blog 时间线仍按时间排序；未来增加“推荐/优先”视图时才采用优先级。

基础设施当前按投影数组顺序展示，producer 按 ID 排序；External 也是继承索引顺序，consumer 没有显式的用户优先级比较器。因此现状更准确的描述是“来源顺序主导”，不保证严格按页面显示名称排序。

### 4.4 完整生效路径与迁移

仅给 Markdown 或 YAML 多写一个数字不会自动生效。knowledge-public-v1 会重建白名单字段，站点索引和 Bookmark 映射又会选择字段；任意一环没接入都会丢失优先级。

实施需要覆盖 producer schema 与校验 → 公开 exporter 白名单 → 不可变 artifact 与 manifest → consumer parser → 索引与 Bookmark/Infrastructure 类型 → 公共对象模型 → 排序 → SSR 与目录端点。投影扩展先评估协议兼容性，不能仅改变 TypeScript 类型就宣布完成。

迁移顺序建议为：

1. Consumer 接受可选新字段并保留旧投影；排序逻辑在字段缺省时有确定结果。
2. 两个 producer 增加字段校验、公开投影和测试，发布新不可变版本。
3. 设置五项精选及三个常用外部资源，更新 committed locks，跑数据物化与完整验证。
4. 首轮可按“某对象有显式 homepage 时优先使用，否则短期读取 portal-pinned”兼容；五项入选和 Personal Twin 的显式排除必须一起迁移，不能只改被选中的五项。
5. 内容迁移验收后移除首页读取 portal-pinned 的回退；保留该 group 是否仍供其他页面使用需查调用。

编辑源数据后，通常仍需 producer 发布、lock 更新、网站构建与交付才能上线。无需再改前端名单，但也不是网页实时热更新。沿用仓库已有公共锁更新流程；本轮未验证自动发布开关或成功交付，不把自动上线视为已完成能力。不要手改 src/data 或 .pds-runtime 中的生成文件。

## 5 键盘命令与导航反馈

### 5.1 命令组的可见状态

建议在既有底部状态栏上方出现紧凑命令提示，避免遮住列表标题或抢走输入焦点。普通状态无额外浮层；按 g 立即出现：

> g · 前往　h 首页　l Library　p Projects　t Tools　a About　Esc 取消

按 r 时只列当前对象实际存在的关联。用已输入键的高亮、候选键和一个静态/短促移动的细线光标提供趣味，避免每个字母解码或高频闪烁。候选项可点击，帮助不应只对熟悉快捷键的人可用。

状态约定：

| 当前状态与输入 | 行为与反馈 |
| --- | --- |
| 空闲 → g 或 r | 立即显示前缀与合法后续操作，建议 100 ms 内可见 |
| 前缀 → 有效键 | 消费一次命令，进入导航中或打开关联 |
| 前缀 → Esc | 只取消这组命令，短暂显示“已取消”，保留当前筛选和选中项 |
| 前缀 → 无效键 | 显示“没有这个命令”并退出；不再把同一按键执行成全局 f、j、数字 Tab 等 |
| 超时 | 自动退出，并显示短暂“命令已超时”反馈 |
| 切页面、窗口失焦、进入输入框或弹窗、切换模式 | 清理未完成前缀，避免残留后缀触发命令 |

当前 1200 ms 可作为已知基线；建议试用 2000 ms，并支持延长或关闭单字符快捷键。反馈出现与定时器清理必须真实执行，不能像现在一样只在下一次 keydown 时检查是否超时。持续按住 g 的 repeat 事件不应不断重新进入命令组。

Esc 按最内层上下文处理：弹窗由弹窗关闭 → 存在前缀则只取消前缀 → 输入框可先退出输入/清空文本 → 其他位置不随意清掉既有筛选。代码审查发现目前前缀清除后会继续执行全局 Esc 清空逻辑，因此取消 g 可能连带清空搜索；这是待回归验证的代码级问题，本次连接中断前未完成最终复现。

### 5.2 页面导航分成等待和切换

建议保留 Astro 静态多页架构作为首轮基线：

1. `g → p` 或正常内部链接激活后，立即显示“前往 Projects…”与不表示百分比的细进度线，并马上发起导航。不要先播完退场动画再请求页面。
2. 等待期间保留旧页面内容、位置和可读性，不提前清空或整屏变暗。超过约 2 秒可更新为“仍在加载…”。
3. 新页面就绪后，对主内容做约 120–180 ms 的淡入或 2–4 px 短位移。底部导航尽量保持视觉稳定，不做整屏大位移。
4. 支持原生跨文档 View Transitions 的环境使用渐进增强；不支持时保留即时反馈并正常导航。原生换页过渡发生在新页面就绪阶段，本身不能填补请求前后的等待。
5. 在 pageshow/BFCache 恢复时清除旧“导航中”状态，避免后退到永久加载提示。快速连续命令应定义为首个已接受的导航生效，并显示目标，避免多次跳转。

动效只使用 opacity/transform 等轻量属性，不加动画库，不对长列表逐行做动画，不把 width/height 连续变化或模糊滤镜放在导航热路径。`prefers-reduced-motion` 下使用静态文字状态和直接切换；颜色变化之外始终有可读文字，适量 aria-live 提示。

链接策略统一覆盖鼠标点击、键盘 Enter、g 导航；同页锚点、下载、新标签、跨站链接、Access 登录不能被误当作站内页面切换。在链接目标中继续保留既有 ui 模式传播规则和查询参数，不引入一份新的路由表。若采用 MPA 导航，不能承诺按 Esc 一定能取消已发出的浏览器请求；“取消命令组”与“取消导航”是不同能力。

可对少数主要公开导航按 hover/focus 或明确意图预取，并尊重省流设置；不抓取数千笔记、完整目录或受保护接口。是否引入 Astro ClientRouter 应放在单独技术验证之后：现有脚本多以首次文档初始化为生命周期，迁移需要解决页面加载、事件解绑、私有链接解锁、焦点、滚动与模式恢复，不能把加一个组件当作完成。

## 6 资源浏览布局与渐进加载

### 6.1 桌面布局

建议把资源浏览页分成三层：固定顶部控制区 → 可收缩的中间浏览区 → 既有固定底栏。顶部第一行放左侧资源 Tab，右侧文本过滤、排序、筛选和计数；第二行容纳一句简短说明与已选筛选条件。宽度不足时自然换行，不压缩搜索框到不可用。

说明可收短为“自托管服务与应用 · 状态来自登记”，旁边用可点击/可聚焦的说明按钮解释 Access 与状态含义，不依赖 hover 才能看到关键内容。没有筛选条件时不要为筛选 chip 预留空白行。

中间仍是左列表、右预览：两者共同占据剩余高度。左侧只有列表及其加载按钮滚动；预览在自己的区域内保持可见，详情过长时可独立滚动。所有 flex/grid 中间层设定正确的 min-height: 0，避免一个子元素把整个页面撑开。Tools/Library 的应用式布局按页面启用，不改变文章阅读页的自然滚动。

导航固定之后，JK 应只滚动当前列表到选中行，不能让 scrollIntoView 顺带移动整个页面。Home 的短列表不套满屏浏览器布局。手机建议保留单列列表与详情弹层/独立阅读，避免左右两个滚动区域；顶部使用一到两行，考虑地址栏和软键盘改变可视高度。

### 6.2 首屏数量由可用高度决定

保留有界 SSR 初始条数，浏览器启动后根据实际列表容器高度、实际行高和少量缓冲补齐首屏。一个可试验的规则是：可见行数向上取整再加 2 行缓冲，至少保留已有 SSR 行，初次自动补齐最多 80 行；这些数值是待测初值，不是新性能结论。

1600 × 1000 的当前 TUI 行高下，Services 应尽量一次展示全部 22 条，External 约展示一个可视区域加缓冲。GUI 行高更大，不能照搬 TUI 行数。字体加载与 ResizeObserver 需合并测量，避免逐行重排；缩小视口不删除已经加载的行。

仅当前可见 Tab 允许因视口自动加载，自动补齐应有次数/条数上限。隐藏 Tab 不应一起下载目录。初次加载失败仍保留 SSR 行，呈现可重试状态。数据不足时的留白是正常终点，应说明“已显示全部”，不复制条目凑满。

本次 External 完整压缩目录约 35 kB，第一阶段可保留现有一次下载、分批渲染；不要为了 395 条数据立即引入虚拟列表或分页 API。Notes 规模更大，需单独测量目录解析和内存开销，不能因为共享组件而自动加载全部笔记。首次 SSR 边界和性能预算仍应守住。

### 6.3 双击 J 继续加载

该能力作为快捷增强，保留可聚焦的“加载更多”按钮、Tab/Enter/Space 路径。

推荐交互为：

1. 正常 j/k 逐项移动，移动到已渲染最后一项时显示“已到当前末尾 · 连按 J 加载更多”。
2. 只有已处在边界后，两次独立、非 repeat 的 j 按键，在建议 400 ms 窗口内才触发一次加载；刚好走到末行的那次 j 不计入双击。其他键、焦点变化、Tab 切换、超时会清除计数。
3. 加载中显示“正在加载…”并去重；长按 J 不应反复下载或追加多批。
4. 成功后选择第一条新追加的数据，滚到可见范围，保持原有筛选与排序；剩余数据全在内存时文案为“显示更多”，交互结果相同。
5. 失败保留原列表、选择和滚动位置，显示“加载失败 · 重试”；按钮与快捷重试调用同一流程。过滤条件或 Tab 在请求中改变后，不用旧请求结果把用户拉回去。
6. 已无更多数据时显示“已到末尾”，不循环回首项；追加的条数和新总数可通过状态区向辅助技术播报。

400 ms 的双击时间要求不能成为唯一操作方式。可在底部按钮获得焦点时使用 Enter，后续根据体验决定是否提供更宽时间窗，避免把连续输入速度当作使用门槛。

### 6.4 状态恢复

每个 Tab 保存自己的查询、筛选、排序、选中 ID、已显示条数、列表滚动锚点。当前 BrowserSnapshot 已保存查询、筛选、选中和 limit，但未显式保存排序与列表滚动位置；浏览器可能恢复父滚动，不能据此保证拆分容器后仍能恢复。

切 TUI/GUI、前进后退时恢复语义位置，优先稳定 ID 与偏移；筛选导致对象不存在时选择首个有效结果并给出提示。Tools 当前查询没有 queryParam 映射，本次输入 linux 后 URL 仍只有 #external，复制链接不能带走筛选；建议将可分享的查询、排序、Tab 放入 URL，像滚动位置这类会话状态留在 history。

## 7 品牌资源统一

本轮需区分三个位置：首页大标记 `public/images/biome-mark.svg`、底栏 `Network` 图标、`public/favicon.svg`。当前它们确实不统一，但首页图形不是 Astro 默认标记。

实现应引用同一组已确定的 Digital Biome 品牌资产：大尺寸标记、小尺寸简化版、单色版本及 favicon。使用 img 或既有资产组件统一尺寸，保留正确替代文本；相邻已写 Digital Biome 时图像可为装饰性，避免重复朗读。预留宽高防止布局跳动。

仓库 `docs/design-explorations/brand-icon-2026-10-07/` 存在多个候选，不能从文件存在推断用户已选定。实施前确认最终文件；若现有 favicon 就是用户认可的品牌，可先复用。此次不重新设计 Logo，也不直接选择某个候选覆盖生产资源。

## 8 补充产品问题与优先级

P1 表示下一轮核心体验优先处理；P2 表示随相关改动解决；P3 表示积累证据后再做。此级别不代表已经实施。

| 优先级 | 问题与证据 | 影响与建议 |
| --- | --- | --- |
| P1 | g/r 无状态，导航无即时反馈，步骤 2 | 无法判断输入是否有效；先统一命令反馈，再做过渡 |
| P1 | 资源排序没有使用优先级，步骤 4 与数据链代码 | 高频资源难找；优先级必须贯穿 producer 到 SSR/目录 |
| P1 | 顶部控制滚走、首屏偏少、JK 到底停住，步骤 3–6 | 核心浏览链断开；作为一个完整资源浏览改动交付 |
| P1 | 前缀 Esc 可能继续清筛选，terminal-navigation.ts | 取消命令不应破坏上下文；补明确消费顺序与回归测试 |
| P2 | 首页名称缺用途、品牌三个位置不一致，步骤 1 与资源文件 | 对外理解成本高；用短解释与同源品牌资产改善 |
| P2 | 底栏所有页面都显示 i/f/1–4，首页并无相应列表筛选，步骤 1 | 帮助在无功能处误导；按页面能力显示，“1–4 类型”也比“标签”准确 |
| P2 | 单字符快捷键为全局监听，没有用户关闭入口，代码审查 | 语音输入和部分辅助技术可能受影响；提供关闭/限制焦点作用域并测试 WCAG 2.1.4 |
| P2 | Tools 查询不进入 URL，BrowserSnapshot 无排序和滚动锚点 | 无法稳定分享筛选或恢复新滚动布局；同时补 URL 与历史状态契约 |
| P2 | 公开预览中出现 portal-ai、portal-pinned 等内部标记，步骤 3 | 访问者看见实现语言；过滤控制标签，映射为“AI / 运维 / 家庭网络”等可读用途 |
| P2 | active 与 planned 同列，说明滚走后语义不可见，步骤 3 | 易把登记状态理解为实时健康；短说明常驻，详情标注“登记状态” |
| P2 | 长标题多处截断，步骤 1/5/6 | 区分相似资源困难；保证键盘选中也能读完整标题，优化列表与预览比例 |
| P2 | 纯标题、简短描述与 Markdown 标记混杂，步骤 4 与源数据 | 资源信息质量参差；从 owner 修订摘要，渲染层按纯文本摘要契约处理，不注入任意 HTML |
| P3 | 资源越来越多后的批量维护 | 先用 Obsidian Properties/YAML 数值编辑，观察真实负担后再考虑批量管理界面 |

已有优点应保留：两种界面共享对象与路由；公开页面只保留私有引用；底栏固定；选择预览与完整链接可达；初始 DOM 有界；列表已有错误和重试结构。不要为了这轮体验优化重建整套门户架构。

无障碍补验应覆盖：命令提示不抢焦点、弹窗焦点恢复、Tab/方向键与 JK 不互相截断、单字符快捷键可停用、200% 缩放和 320 px 宽度回流、真实触摸命中面积、普通文字对比度与选中态辨识。当前截图能证明截断与信息密度，不能替代对比度测量或读屏测试。

## 9 实施切片与验收

| 切片 | 范围 | 完成标准 |
| --- | --- | --- |
| A 命令反馈 | 前缀、取消、超时、有效后缀、上下文提示 | g 后立即看到候选；Esc 保留筛选；r 数字不误切 Tab；输入法/输入框/弹窗不被劫持 |
| B 资源浏览 | 工具栏、滚动容器、自适应首屏、双 J、加载状态和恢复 | 大屏不因硬编码条数留下可填空白；Tab/筛选始终可达；鼠标和纯键盘均能从首项到全部结果 |
| C 数据驱动策展 | 两个 producer、字段透传、确定排序、首页五项、数据锁 | 只修改源配置即可改变投影结果；1/1/2/缺省、非法值、空精选、状态变化与旧投影兼容测试通过 |
| D 页面过渡 | 即时导航状态、MPA 渐进动效、必要的预取 | 反馈不晚于建议 100 ms；不人为延迟请求；网络慢时旧内容可读；后退无残留加载；减弱动画正常 |
| E 品牌与文案 | 已确认 Logo、名称、用途、标签和帮助说明 | 首页/底栏/favicon 同源；16/32 px 可识别；不再向访客展示控制标签 |

推荐顺序：A → B → C → D/E。A、B 提升每次使用的体验；C 的 producer/consumer 契约应尽早定稿，其发布迁移独立验收，不被动效开发拖住。Logo 定稿是 E 的唯一资产选择依赖，不阻塞其他方案。

关键验收情景：

- 视口：1366 × 768、1600 × 1000、1920 × 1080；390 × 844 手机及 320 px/200% 缩放；TUI 和 GUI 都验收。
- 数据：0/1/12/16/22/395 条；三项同为优先级 1；全部缺省；名称相同；筛选后只剩末尾项目；重复 ID/非法值由契约拒绝。
- 输入：g-p、g-a、g-Esc、无效后缀、r-1、超时、长按、IME、编辑框、Tab/Shift+Tab、Enter/Space、边界双 J。
- 异步：首次目录慢、失败重试、重复点击、加载时改筛选/切 Tab、后退恢复、BFCache、模式切换。
- 内容：五个首页对象与正确身份关联；移除 Personal Twin 首页入选不删除 Tools 资源；LiteLLM 名称不误指其他项目；公开/受保护访问方式准确。
- 性能：先记录同环境冷/暖导航的多次样本，再比较反馈延迟、LCP/INP/CLS、JS 增量与目录耗时。目标是即时反馈和无明显额外长任务，不用动画伪装性能提升。

代码实施时先跑针对行为的验证，再运行仓库要求的 `pnpm sync:data-products` 和 `pnpm verify:full`。已有性能上限包括 Tools HTML 96 KiB 原始/16 KiB gzip、dist JavaScript 100 KiB、External terminal catalog 400 KiB；这是现有门禁，不是本轮测得的新结果。保留 SSR 行数与完整目录前缀一致性检查；若改变初始条数必须解释预算影响，不能直接放宽预算掩盖回归。

本次交付仅为审查、证据及优化方案，故未运行生产构建或测试套件，未改 producer 配置、数据锁或应用代码。上述验收均为后续实施完成标准。

## 10 可追溯代码入口

| 主题 | 当前文件 |
| --- | --- |
| 首页常用与大 Logo | [首页](../../src/pages/index.astro)、[GUI 首页](../../src/components/common/GuiHome.astro) |
| portal-pinned 筛选与排序 | [personal-systems](../../src/utils/personal-systems.ts) |
| 基础设施投影与类型 | [infrastructure](../../src/utils/infrastructure.ts)、[infra-public-v2](../../src/domain/infrastructure/infra-public-v2.ts) |
| 外部资源与公共对象映射 | [bookmarks repository](../../src/repositories/bookmarks-repository.ts)、[terminal repository](../../src/repositories/terminal-repository.ts) |
| 既有 homepage 字段与排序 | [notes types](../../src/types/notes.ts)、[assets repository](../../src/repositories/assets-repository.ts)、[asset index merger](../../scripts/sync/merge-asset-index.ts) |
| 首屏数量与 Tab | [Tools 页面](../../src/pages/tools/index.astro) |
| 分栏、列表与加载按钮 | [ObjectBrowser](../../src/components/terminal/ObjectBrowser.astro)、[terminal objects](../../src/browser/terminal-objects.ts) |
| 组合键与 Esc | [terminal navigation](../../src/browser/terminal-navigation.ts) |
| 页面壳与视口滚动 | [BaseLayout](../../src/layouts/BaseLayout.astro)、[TerminalLayout](../../src/layouts/TerminalLayout.astro)、[global styles](../../src/styles/global.css) |
| 品牌、底栏和帮助 | [Header](../../src/components/common/Header.astro)、[首页标记](../../public/images/biome-mark.svg)、[favicon](../../public/favicon.svg) |
| 历史状态与约束 | [BrowserSnapshot](../../src/view-models/browser-snapshot.ts)、[模式状态契约](17-ui-mode-state-contract.md) |
| 交付来源与性能门禁 | [knowledge lock](../../data-products/knowledge-public-v1.lock.json)、[infra lock](../../data-products/infra-public-v2.lock.json)、[性能预算](../../scripts/check-performance-budgets.ts) |

上游核对入口：Personal Infrastructure 的 `inventory/public-infrastructure.yaml` 与 `scripts/export_infra_public_v2.py`；Thought Forest 的 `docs/knowledge-base-metadata-reference.md`、`scripts/knowledge-index/types.ts`、资源 `z/linux-do.md`、`z/bilibili.md`、`z/youtube.md`。上游工作目录用于确认现有契约，生产数据身份仍以本站 committed locks 为准。

## 11 首批实施记录

2026-10-07，基于 `a1bc528` 实施 A/B，并复用同一状态区提供 D 的即时导航反馈。未修改 producer、数据锁或品牌资产；本节描述工作区代码，不代表生产已部署。

- **A 命令反馈**：g 使用既有导航策略生成可点击候选，r 只列所选对象已有关系；Esc、无效后缀、超时分别消费命令，不再触发第二个全局动作。失焦、输入框、弹窗、页面恢复和模式切换清理前缀。帮助提供单字符快捷键开关和 2/5 秒等待偏好，存储失败保留当页选择。
- **B 资源浏览**：Tools、Notes、Blog 桌面使用固定控制区和独立列表/预览滚动；手机保留单列与详情弹窗。SSR 12/16 条不变，仅当前 Tools 标签按实测高度补齐，自动最多 80 条；Notes 仍需明确操作才下载完整目录。边界两次非 repeat 的 J 共用加载按钮流程，失败可重试，完成后选择并聚焦首个新增条目；旧请求不能抢回已切换的标签或筛选。
- **B 状态**：默认保留投影顺序，可手动选择名称排序；这不是 C 的 usage_priority 排序。URL 分享查询、筛选、排序和标签；history 验证并保存独立标签的选择、数量与稳定 ID/偏移滚动锚点。切换 TUI/GUI、前进后退恢复语义位置。
- **D 部分**：站内链接与 g 导航立即显示目标和静态进度线，2 秒后显示仍在加载；旧内容保持可读，首次接受的导航生效，pageshow 清理状态。站外、新标签、下载、同页锚点及 Access 流程保持原行为。未添加页面动画、预取或 ClientRouter。
- **C/E 后续**：usage_priority、homepage 契约与 producer 迁移尚未实施；Logo 仍需已确认资产。原文的建议五项名单与旧 portal-pinned 规则没有改动。

验证入口：[交互回归](../../e2e/resource-interactions.spec.ts)、[历史状态契约测试](../../src/view-models/browser-snapshot.test.ts)。本地验收结果见第 12 节。


## 12 后续实施与发布迁移（2026-10-07）

本节接续首批记录。以下均为三个仓库的本地工作区代码与源配置，不等于生产已发布。

- **A/B 收口**：修正 GUI 窄屏搜索框被排序控件挤压、底栏 About 被裁切、帮助文字换行；补充 320/390 px 的输入宽度和末项可见性断言。旧故障注入测试改为在页面导航前拦截目录请求，以覆盖新增的自动首屏加载。
- **C 消费端**：资源采用 `usagePriority` → 固定 `zh-CN` 数字名称顺序 → 稳定 ID；Notes/Blog 时间排序与 Pagefind 相关性不变。优先级通过公开投影验证、Markdown 物化、本地索引、上游元数据协调和 Bookmark 映射。SSR 与延迟目录共用排序入口。
- **C 首页**：`homepage.enabled && featured` 且 active 的服务入选，按独立的 `homepage.order` 排序，兼容 0；名称和用途可覆盖。两种首页复用 `FeaturedSystems`，名称链接公开介绍，另列公开入口或登录访问。空配置、停用/退役和部分迁移不会逐项回退旧名单。
- **C 源配置**：Personal Infrastructure 增加可选契约并迁移原六个 pinned 对象；哪吒面板、MemoFlow、Homepage、LiteLLM、Hermes 使用既有 ID，顺序 10/20/30/40/50，Personal Twin 明确排除首页。LiteLLM 按方案示例设置 `usage_priority: 2`；其余服务尚未额外猜测常用顺序。Thought Forest 的 LinuxDo、bilibili、YouTube 均配置 `usage_priority: 1`，并同步元数据文档、索引、导出与验证。
- **D**：已有即时反馈之外，支持原生跨文档 View Transitions 的浏览器使用 160 ms 主内容淡入与 2 px 位移；底栏不参与内容动画。减弱动画时不启用。没有引入 ClientRouter、动画库或预取。
- **E**：用户明确选择现有 favicon；首页大标记、GUI 页头、TUI 底栏与浏览器图标统一引用 `/favicon.svg`，保留尺寸和装饰性空 alt。资源预览/详情将 portal 分类转为应用、AI、运维、家庭网络，隐藏 pinned 控制标签；状态标注为登记状态。

本地完整 producer 导出经过本站解析与隔离物化，确认五项身份、名称、顺序、访问类型，以及三个网站的优先级；证据为 [producer 链路结果](evidence/2026-10-07-implementation/producer-curation.json)。该结果不是 immutable Release 身份证明，未修改 `src/data` 或 `.pds-runtime` 冒充新发布。

### 发布顺序与退出兼容

1. 先交付可兼容旧投影的本站代码。仅**完全不含 homepage 字段的历史投影**继续支持旧 `portal-pinned`；任何显式配置存在后，入选只按新契约判断。
2. 提交并发布两个 producer 的已验证源配置，由既有工作流产生 immutable data-product Releases。不要用脏工作区 HEAD 或本地导出文件伪造发布身份。
3. 通过既有 consumer reconciliation 更新 committed knowledge/infra locks，重新运行 `pnpm sync:data-products`、`pnpm verify:full` 与浏览器验收，确认真实构建中五项精选、三个网站优先级、SSR/目录一致且 Personal Twin 仍在 Tools。
4. 新数据锁完成发布后删除历史 `portal-pinned` 兼容分支，继续保留空配置与生命周期回归测试。

当前没有提交、推送、PR、数据产品发布或站点部署。

### 本地验收结果

- `pnpm sync:data-products` 通过，使用未修改的 committed locks。
- `pnpm verify:full` 通过：34 edge + 132 unit + 223 script = **389 项通过、2 项跳过**。类型检查 0 errors / 0 warnings，3 个既有 IME keyCode 提示。
- 最后发现并修复 TUI 320 px 底栏裁切，以及 g/r 前缀拦截 Tab；这两处修正额外通过 `pnpm check`、`pnpm build:only`、`pnpm check:performance`，并在最终产物上完成 **27/27 Chromium 浏览器回归**。
- 两种模式均覆盖 1366×768、1600×1000、1920×1080、390×844、320×844；最小搜索输入宽度 128 px 和底栏末项完整可见均有断言。IME 事件、减弱动画、目录故障注入、状态恢复、普通导航和受保护链接 mock 解锁均在回归中覆盖。
- 性能门禁未放宽：Tools HTML **89.3 KiB / 96 KiB**，gzip **14.1 / 16 KiB**；JavaScript **68.4 / 100 KiB**；CSS **132.1 / 190 KiB**。Notes 12 / External 16 条 SSR 边界及目录前缀一致性通过。
- Personal Infrastructure exporter/发布工作流 **51 项通过**；Thought Forest 公开投影/发布工作流 **79 项通过**（使用 package-lock 恢复依赖后再次通过）；YAML、变更笔记审计与文档漂移检查通过。
- 未实测真实读屏/触摸与输入法硬件、原生 200% 浏览器缩放、WebKit/Firefox，以及冷暖导航的 LCP/INP/CLS 对比；本地测试不构成生产交付证明。

| 切片 | 验收状态 | 证据与剩余工作 |
| --- | --- | --- |
| A 命令反馈 | 本地完成 | 前缀/取消/超时/禁用、IME、Tab、导航回归通过 |
| B 资源浏览 | 本地完成 | 桌面独立滚动、窄屏、双 J、失败重试、URL 与历史恢复通过 |
| C 数据策展 | 本地链路完成，发布迁移未完成 | 两个 producer 测试与真实源导出→consumer 隔离物化通过；新 Releases/locks 与兼容分支退出仍待后续发布 |
| D 页面过渡 | 本地完成；预取暂缓 | 原生 MPA 渐进动画与减弱动画路径；未以预取改变网络行为，也未声称真实加载性能改善 |
| E 品牌与文案 | 本地完成 | 已确认 favicon 同源复用，首页说明与访问路径、控制标签和登记状态已改 |

[机器可读验收记录](evidence/2026-10-07-implementation/verification.json) · [浏览器日志](evidence/2026-10-07-implementation/browser-tests.txt) · [性能预算](evidence/2026-10-07-implementation/performance.txt) · [GUI 手机截图](evidence/2026-10-07-implementation/mobile-gui.png) · [TUI 手机截图](evidence/2026-10-07-implementation/mobile-tui.png)。截图和最终构建仍使用当前 committed 数据锁，因此不能用它们声称五项新精选已经上线。


## 13 PDS 共享契约补齐（2026-10-07）

用户追问跨仓库同步情况后，发现上轮遗漏 Personal Digital System 的
`contracts/knowledge-public-v1.schema.json`。该 schema 对 note 设置了
`additionalProperties: false`，新 `usagePriority` 字段原先会被拒绝。
现已补入可选正整数/null 字段、共享契约说明、旧/新/非法值测试，并接入 Catalog CI。
PDS 的 5 项测试、catalog 校验，以及包含 3772 篇公开 note 的本地 Thought Forest 导出对共享 schema 的验证均通过。

此次不改变 PDS 系统目录、组件关系或 `pds-catalog-v1` 的 payload；基础设施资源字段契约继续由 Personal Infrastructure 拥有。
发布顺序补充为：先提交 PDS 共享契约与兼容 consumer，再发布两个 producer，更新本站两个数据锁并验收部署。
上述四个仓库仍仅为本地改动，尚未提交、推送或发布。

## 14 发布前内容修正与集成范围（2026-10-07）

用户已授权推送发布，并追加以下内容修正：宝可梦机场主入口为
`https://love3.p6m6.com/`，`baokemengfree.com` 是另一家服务；Google Stitch
入口为 `https://stitch.withgoogle.com/`；ChatGPT 添加 `usage_priority: 1`。
常用网站因此为 bilibili、ChatGPT、LinuxDo、YouTube 四项，同优先级按名称排序。

发布前核对发现 Thought Forest 工作分支领先主线 461 个提交，Google Stitch 的
正确地址只存在于工作分支；Personal Infrastructure 也在另一个功能分支。
此次基于各仓库最新 `origin/main` 建立独立发布 worktree，只迁入本次字段、配置和
笔记修正。未将其他笔记优化或服务器配置的未合入提交纳入发布。
PDS 最新主线已有 unittest discovery，新增共享契约测试复用现有 CI，无须再改工作流。

以下先提交兼容旧锁的站点实现，随后发布两个 producer、更新数据锁并退出旧名单兼容。
最终交付必须另附 producer Release、站点 Release、部署身份和线上验收证据。
