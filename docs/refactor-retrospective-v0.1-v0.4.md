# Digital Biome v0.1.0–v0.4.0 重构复盘

这份文档保留原 `/about/refactor` 临时学习页面的有效内容。该页面最初用于在 AI 推进项目重构时快速观察“改了什么、为什么改、收益是什么”，不属于长期网站信息架构，因此网页入口与交互展示已退役；长期知识改由项目文档维护。

更详细的逐阶段实施记录见：

- `docs/refactor-optimization-2026-09.md`
- `docs/refactor-optimization-phase2-2026-09.md`
- `docs/refactor-optimization-phase3-2026-09.md`
- `docs/refactor-optimization-phase4-2026-09.md`

## 核心结论

这轮重构的目标不是“把代码拆得更小”，而是把**成本、职责和风险放回正确边界**。判断是否值得重构，应优先看可测量的问题、职责漂移、安全边界和维护成本，而不是文件长度或目录是否足够“架构化”。

## 四轮演进

### Phase 1 — 先解决真正昂贵的首屏数据

问题：`/notes` 曾把完整笔记元数据放进初始 HTML，About Hero 也复制了大量标签 DOM。用户只浏览首屏，却提前支付了完整知识库的数据和标记成本。

处理：Notes 只 SSR 少量首屏卡片，完整 catalog 改为按需加载；About 仅展示代表性标签，完整标签目录留在独立页面。

结果：当时 `/notes` raw HTML 从约 `1089.4 KiB` 降到 `47.8 KiB`，说明最有效的优化来自数据边界，而不是微调框架运行时。

### Phase 2 — 收敛事实源，并用真实浏览器验证

问题：Tools、Notes metadata、派生索引和浏览器行为存在多个 owner；局部逻辑各自能运行，但组合后容易漂移。

处理：Tools 改为有限 SSR + deferred catalog；notes-index 成为派生 tag / asset index 的统一快照；加入 production-built Chromium E2E。

结论：一个事实应只有一个 owner，派生结果必须能够从 owner 重建；HTTP/unit 测试不能替代真实浏览器交互验证。

### Phase 3 — 减少重复标记，而不是为了数字删内容

问题：完整标签目录和贡献热图的主要成本来自重复 SVG、重复 utility class 和重复 tooltip subtree，而不是有效内容本身。

处理：保留完整 SSR 数据，压缩重复结构，把展示行为下沉到共享 CSS / data attributes，同时移除无 runtime owner 的生成物。

结论：优化应该区分“有价值的数据量”和“重复表达同一件事的结构成本”。

### Phase 4 — 把安全和工程质量变成持续约束

问题：旧 frontmatter scanner 对 quoted boolean 等语义不可靠；删除静态页面也不能保证旧 CDN cache 立即失效；质量检查如果只靠人工，也会持续回退。

处理：统一 full-YAML adapter；private 内容从构建产物、搜索索引和 runtime route 多层阻断；Biome 零 warning 与 Prettier incremental ratchet 纳入 canonical verify。

结论：安全边界要覆盖“发布之后”，工程质量要通过可持续门禁而不是一次性大扫除维护。

## 可迁移到其他项目的原则

1. **先量化，再重构。** 先确认昂贵的是 HTML、DOM、JavaScript、网络还是数据，再决定改哪里。
2. **边界优先于技巧。** 把完整数据推迟到真正需要时加载，通常比局部微优化收益更大。
3. **一个事实只有一个 Owner。** metadata、派生索引、runtime projection 都需要明确事实源。
4. **安全要覆盖发布之后。** 需要考虑旧缓存、搜索索引、静态产物和 runtime 撤销语义。
5. **质量门禁要可持续。** 用 ratchet 逐步消化历史债务，比一次性格式化整个仓库更稳健。
6. **不要为了重构而重构。** 没有性能、维护、测试或职责证据的目录搬家和组件拆分，不构成架构优化。

## 当前约束

原始 v0.1.0–v0.4.0 重构 backlog 已经收口。后续只有在出现新的性能数据、维护痛点、真实 bug 或明确职责证据时，才开启新的重构工作。

网站本身不再展示“重构实验室”。相关演进知识属于仓库文档，而不是长期用户导航或个人主页内容。
