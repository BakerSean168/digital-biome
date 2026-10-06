# TUI / GUI · Figma 设计审查

日期：2026-10-06。范围：Home、About、Tools 的 GUI NEXT，与既有 TUI R1 配对；没有实施应用双界面代码，也没有生产部署或提升 CURRENT。

## 在哪里看

Figma Desktop 当前文件 `digital-biome`，`01 · Product`（3313:2）。沿 Home、About、Tools 的 module row 找到 `NEXT R1 · Dual UI`：同一个 cluster 左侧为既有 TUI Desktop/Mobile，右侧为 GUI Desktop/Mobile。Tools 四类纵向排列。

| 视图 | GUI Desktop | GUI Mobile | NEXT cluster |
| --- | --- | --- | --- |
| Home | 3474:12426 | 3474:12476 | 3458:9915 |
| About | 3474:12518 | 3475:12561 | 3458:9917 |
| Tools · Services | 3475:12592 | 3476:12665 | 3460:9925 |
| Tools · External | 3476:12732 | 3476:12800 | 3460:9925 |
| Tools · Hosts | 3476:12862 | 3476:12930 | 3460:9925 |
| Tools · Network | 3476:12992 | 3476:13050 | 3460:9925 |

12 张 GUI 页面，Desktop 1440×900、Mobile 390×844。双界面规格板：3474:12411，位于 Product 顶部文档区右侧。原始 CURRENT、LEGACY、Product Map 与 Product Definition 不作为这次修改目标。

服务筛选弹窗 Desktop / Mobile：3476:13208 / 3476:13222。`03 · Foundations` 新增 GUI 基础板 3477:13240；`02 · Components` 的 WORKING 区新增部件板 3477:13262，包含资源默认行、选中行、模式选中态、Tab 默认态四个原生主组件草稿。颜色为 7 个共享样式，字体为 10 个共享样式。没有覆盖原有样式，也没有声称产品画板已绑定组件实例。

## 与 v2 的差异

Home 先说明身份和网站用途，之后用少量文本入口连接知识、项目和资源；Blog 与 Notes 分开呈现。About 回到阅读与个人实践，生态关系是旁注。Tools 从大量卡片转为名称、用途与入口组成的行，桌面详情放在侧栏，手机首先提供直接动作。

深灰、苔绿、细分隔线保留。GUI 使用正常正文排版，减少等宽命令文字、状态徽标、假遥测与重复装饰。没有为模式切换加入管理、编辑或登录前置流程。

## 原型演示范围

- 在 GUI 的 Home、About、Tools 之间导航。
- Tools 的服务、外部资源、主机、网络相互切换，保持设备尺寸。
- 对应 12 对页面通过底栏 TUI / GUI 双向切换；这是固定示例之间的导航，不是任意浏览状态持久化。
- Services 的筛选按钮打开同尺寸的 GUI 弹窗，“取消”或“完成”关闭。弹窗只展示访问方式与宿主的布局，尚不执行条件选择和列表计算。

当前选中的 Tab 不设置自跳转。社区 MCP 拒绝同一画板的 NAVIGATE，因此选中态保留视觉反馈，其余 Tab 导航到有效的同页顶层画板。

Library、Projects、阅读详情、Search、Access、外部访问与任意对象详情尚未制作 GUI 交互流；不通过跳入 TUI 来伪装 GUI 已覆盖。屏幕中文字输入为设计样例，不能在 Figma 中输入真实查询。底部固定与内部滚动在本轮表现为布局和契约，当前 companion 工具没有滚动原型属性的设置接口，真实滚动与键盘验收留在代码阶段。

## 设计与代码的交接

[16 · 产品定义](16-dual-ui-product-definition.md) 记录双界面职责；[17 · 状态契约](17-ui-mode-state-contract.md) 定义 URL 与本地偏好；[18 · 页面规格](18-gui-design-specification.md) 规定内容层级；[19 · 实施计划](19-dual-ui-implementation-plan.md) 排列共享状态、逐页实现与验收。

两种界面共用同一内容源、路由、查询、筛选、选择和权限。服务入口仍由真实 Access 规则保护。后续验收应验证跨模式的对象 ID 和阅读锚点恢复，而不是仅验证颜色切换。未实现的模式支持不得影响已有 TUI 的键盘操作与懒加载边界。

## 构建记录

原生 Frame/Text、共享画色与字样式、Auto Layout；没有铺整页截图作为设计。可恢复操作日志、节点映射与最终 QA 位于 `.artifacts/dual-ui/`。本轮 Figma 与文档修改不构成任何应用测试或部署证据。

## 最终检查与截图

- 12 张 GUI 画板的尺寸、所属 module cluster 与 Desktop/Mobile 配对通过检查；子节点无越界，NEXT 画板之间无重叠，三个 cluster 均完整包含于原 module row。
- 对受影响三行的 CURRENT 与 LEGACY 读取前后树并比较：3 个 CURRENT 容器、2 个 LEGACY 容器及其全部子节点完全一致，含 6 张 canonical 和 4 张 legacy screen。其他 module 未修改；没有将全文件所有旧画板冒称为本轮重新验收。
- 101 个原型源节点逐个读回，通过目标、动作和空选中态校验，包含 24 条 TUI/GUI 双向连接、类别/主导航与弹窗打开/关闭。
- 12 张页面、2 个弹窗、Foundations 与 Components 共 16 张最终截图已导出；人工检查桌面/手机的排版、层级和可见文字。当前 Figma 页面仍为 `01 · Product`。

| 视图 | Desktop | Mobile |
| --- | --- | --- |
| Home | [截图](evidence/dual-ui/gui-home-desktop.png) | [截图](evidence/dual-ui/gui-home-mobile.png) |
| About | [截图](evidence/dual-ui/gui-about-desktop.png) | [截图](evidence/dual-ui/gui-about-mobile.png) |
| Services | [截图](evidence/dual-ui/gui-services-desktop.png) | [截图](evidence/dual-ui/gui-services-mobile.png) |
| External | [截图](evidence/dual-ui/gui-external-desktop.png) | [截图](evidence/dual-ui/gui-external-mobile.png) |
| Hosts | [截图](evidence/dual-ui/gui-hosts-desktop.png) | [截图](evidence/dual-ui/gui-hosts-mobile.png) |
| Network | [截图](evidence/dual-ui/gui-network-desktop.png) | [截图](evidence/dual-ui/gui-network-mobile.png) |
| 服务筛选弹窗 | [截图](evidence/dual-ui/gui-filter-desktop.png) | [截图](evidence/dual-ui/gui-filter-mobile.png) |

[Foundations](evidence/dual-ui/gui-foundations.png) · [Components](evidence/dual-ui/gui-components.png)。截图是审查证据，实际可编辑设计仍在 Figma。
