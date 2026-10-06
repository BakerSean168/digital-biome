# Digital Biome 双界面

Digital Biome 是个人数字生态的展示、分享与日常访问层。同一份内容、同一组路由，提供 TUI 与 GUI 两种呈现。底栏切换会记住选择；`?ui=tui` / `?ui=gui` 是临时分享覆盖。首次访问默认 TUI。

## 规格与交付记录

- [产品语义](design-preparation/16-dual-ui-product-definition.md)
- [状态与 URL 契约](design-preparation/17-ui-mode-state-contract.md)
- [GUI 页面规格](design-preparation/18-gui-design-specification.md)
- [实施顺序与验收](design-preparation/19-dual-ui-implementation-plan.md)
- [Figma 设计阶段证据](design-preparation/20-dual-ui-design-review.md)
- [代码实施与验收](design-preparation/21-dual-ui-code-delivery.md)

设计阶段文档保留当时的范围说明；当前实现状态以代码交付记录为准。双界面不提供两份可独立编辑的数据，不改变 Access 权限，也不引入管理后台。
