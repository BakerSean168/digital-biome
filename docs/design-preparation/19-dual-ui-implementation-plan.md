# 双界面后续代码实施计划

日期：2026-10-06。当前交付为 Figma NEXT 和文档；本文件不代表双界面运行时代码已完成。

## 1. 先建立共享浏览状态

从 terminal-objects / terminal-facets / terminal-navigation 中明确界面无关的对象查询、筛选、选择与导航状态。保留现有已经验证的 OR/AND 筛选、草稿确认/取消、懒加载与私有链接解析语义。以公开对象 ID 作为选择标识，避免 TUI/GUI 各自维护一份列表位置。

验收：同一输入在两种呈现得到同样的对象集合；模式切换前后 query、facets、active category 和 selected ID 一致；空结果与加载失败不同；加载更多不会丢掉选择。

## 2. 界面偏好与路由

实施 17-ui-mode-state-contract.md。建立只接受 tui/gui 的解析与存储模块，页面开始绘制前应用 mode；实现手动选择、URL 临时覆盖和存储不可用回退。共用 navigation-policy，不复制两份路由表。

验收：首次访问默认 TUI；持久选择可记住；带 ui 的分享链接临时覆盖；手动切换后刷新不反跳；无效参数不报错；query/hash 和 canonical 正确；深链接和浏览器前进后退可恢复。

## 3. 先落三个页面

BaseLayout 保留唯一 html 壳。TUI/GUI 的导航和正文组织可以不同，数据、Search、Access、资源链接与状态共用。

顺序：Home → About → Tools。Home 验证同路由切换与共同内容；About 验证长阅读和滚动；Tools 验证共享筛选/对象选择、懒加载、私有入口和模式切换。每步完成桌面/手机检查后再扩展。

避免一次输出两份全量 HTML 后 display:none；保持 Notes 12 条和外部资源16条的首屏边界，界面切换不成为体积预算翻倍的理由。必要时采用小型交互组件承载变化区域，而不是引入整站客户端框架。

## 4. 扩展到其他模块

Library、Blog、Projects、详情、Friends、Access、404 逐页收敛。GUI 不得遇到未设计页面就静默更改用户偏好。过渡期如果尚未支持某页面，采用共用中性正文壳和已选模式导航，并清楚记录覆盖范围。

Project Detail route 歧义需独立决定并建立 redirect/index/link 验证；它不是两种界面上线的附带改名。

## 5. 完整验收与发布

行为测试覆盖模式解析与持久性、URL、查询/筛选组合、选择恢复、焦点和外部链接。浏览器覆盖 390×844 与 1440×900、输入法、键盘、手机软键盘、阅读锚点。用带 Cloudflare Functions 的环境验证 Access，静态预览不能证明登录成功。

保留原性能预算、泄漏扫描、Pagefind 和 committed projection 检查，运行 pnpm verify:full。候选记录必须包含源码/数据/产物/环境标识。Figma prototype 连线只证明设计流程可演示，不能替代真实运行时行为验收。

## 风险与取舍

最大成本不是多一套颜色，而是展示组件与验收矩阵增加。控制方法是两种呈现共用业务状态，限制特殊布局，并为每个 GUI 页面定义实际任务。若某页面两种布局没有独立价值，允许共用正文，而不是为了模式差异重复实现。
