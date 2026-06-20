# Astro Check 现存错误治理方案

更新时间：2026-06-20

## 背景

当前仓库已安装 `@astrojs/check`，执行 `pnpm astro check` 后得到：

- `24 errors`
- `23 hints`

这 24 个错误并不是 24 个彼此独立的小问题，而是 5 组重复出现的类型边界问题。它们的共同特征是：

- `Astro Content Collections` 的真实类型没有被贯穿到页面和工具函数里
- 服务端数据模型和客户端序列化模型混用了
- 某些页面直接消费“宽松数据”，缺少前置收窄

因此，最优处理策略不是逐行消音，而是先修数据边界，再消重复错误。

## 错误分组总览

### 1. NotesSidebar 标题可空问题

文件：

- `src/components/notes/NotesSidebar.astro`

错误数：

- `1`

症状：

- `entry.data.title` 被推断为 `string | undefined`
- 但组件内本地 `NoteEntry.title` 要求 `string`

根因：

- 这个组件直接调用 `getCollection('notes')`
- 没有走项目里已经存在的 `normalizeTitle()` / `getAllNotes()` 这条“标题兜底”路径

优雅处理方案：

- 不要在组件里直接重新读原始 collection
- 改为复用 `getPublicNotes()` 或新增一个专门给侧边栏用的 helper
- 在数据边界统一保证 `title` 非空，而不是在渲染层到处写 `|| entry.id`

推荐实现方向：

- 新增 `getPublicNotesForSidebar()` 或直接复用 `getPublicNotes()`
- 把 `NoteEntry.title` 的非空保证前移到 `src/utils/notes.ts`

---

### 2. ResumeHeader 的 icon 类型与页面数据不一致

文件：

- `src/pages/about/resume.astro`
- `src/pages/about/resume-ai.astro`
- `src/pages/about/resume-ai-fullstack.astro`
- `src/pages/en/about/resume.astro`
- `src/pages/en/about/resume-ai.astro`

错误数：

- `5`

症状：

- 页面里写的是 `{ icon: 'phone', text: '...' }`
- 组件 `ResumeHeader.astro` 需要的是 `ContactItem[][]`
- 但页面中的 `contactRows` 被推断成普通 `string`，没有收窄到 `ResumeIcon`

根因：

- `ResumeIcon` 只定义在组件内部
- 页面侧的静态数据没有共享这份类型
- 于是 TS 只能把 `'phone' | 'mail' | ...` 当成普通 `string`

优雅处理方案：

- 把 `ResumeIcon` / `ContactItem` 提升到共享类型文件
- 或者把 `contactRows` 移到单独数据模块，使用 `as const satisfies ContactItem[][]`
- 不建议继续靠页面内联数组让 TS 猜类型

推荐实现方向：

1. 新建 `src/types/resume.ts`
2. 导出：
   - `type ResumeIcon`
   - `interface ContactItem`
3. 在各个 resume 页面中：
   - `const contactRows = [...] satisfies ContactItem[][]`

更优雅的进一步处理：

- 把中英文简历页的联系信息抽到 `src/content/meta/` 或 `src/data/resume/`
- 让页面只负责选择数据，不负责重复定义结构

---

### 3. Asset 详情页的 entry 类型过宽，asset_id 又是可选

文件：

- `src/pages/services/[assetId].astro`
- `src/pages/tools/[assetId].astro`
- `src/pages/infrastructure/[assetId].astro`
- `src/pages/en/services/[assetId].astro`
- `src/pages/en/tools/[assetId].astro`
- `src/pages/en/infrastructure/[assetId].astro`

错误数：

- `12`

每个文件各 2 个错误：

- `render(entry)` 的 `entry` 类型过宽
- `entry.data.asset_id` 是 `string | undefined`

根因：

- 当前项目自定义了 `NoteCollectionEntry`，其中 `collection: string`
- 但 `astro:content` 的 `render()` 需要更精确的 generated type
- 同时 `asset_id` 在 schema 里是可选字段，虽然这些页面的 `getStaticPaths()` 实际上已经筛出了 asset 页面，但 TS 并不知道

优雅处理方案：

核心原则：不要让“已经被筛选成资产”的 entry，到了页面里还是一个宽松 note。

推荐实现方向：

1. 用 `CollectionEntry<'notes'>` 取代自定义过宽的 `NoteCollectionEntry`
2. 引入更窄的资产类型，例如：
   - `type AssetNoteEntry = CollectionEntry<'notes'> & { data: { asset_id: string; asset_type: ... } }`
3. 在 `getAssetsByType()`、`getAssetsByAssetIds()`、`getRelatedAssetsByParent()` 等 helper 内完成类型收窄
4. 让 `[assetId].astro` 页面只接收已经收窄过的 `AssetNoteEntry`

这样可以一次性消掉两类错误：

- `render(entry)` 的类型不匹配
- `entry.data.asset_id` 的可选性问题

进一步的优雅重构：

- 六个 `[assetId].astro` 页面结构高度重复，适合抽成共享工厂或共享 loader
- 例如：
  - `src/utils/assets.ts` 里统一提供 `buildAssetPageProps(...)`
  - 页面只处理语言前缀和展示差异

---

### 4. Notes 详情页仍在使用旧字段 `date`

文件：

- `src/pages/en/notes/[...slug].astro`

错误数：

- `4`

症状：

- 代码在读 `entry.data.date`
- 但当前 `src/content/config.ts` 的 notes schema 只有：
  - `created`
  - `updated`
- 同时 `updated` 的类型是 `string | Date`

根因：

- 页面还停留在旧内容模型
- 内容 schema 已经演进，但 detail page 没有一起迁移

优雅处理方案：

- 明确站内笔记只保留一个统一日期策略

推荐策略：

1. 展示主日期时优先 `updated`
2. 没有 `updated` 时回退 `created`
3. 所有页面统一走一个日期 helper，例如：
   - `getDisplayDate(entry.data)`
   - `toDateValue(entry.data.updated ?? entry.data.created)`

不建议的方案：

- 在页面里继续混用 `date / created / updated`
- 到处写 `new Date(...)` 和 `toISOString()` 的临时判断

更优雅的长期方案：

- 在 `src/utils/date.ts` 增加内容模型专用 helper
- 例如：
  - `resolveContentDate(data)`
  - `resolveContentDateISO(data)`
  - `formatContentDate(data, locale)`

---

### 5. Notes 列表页把服务端日期模型和客户端 JSON 模型混在一起

文件：

- `src/pages/notes/index.astro`
- `src/pages/en/notes/index.astro`

错误数：

- `2`

症状：

- `notesData` 前半段 `rawDate` 来自 `Date | string | null`
- fallback mock data 又把 `rawDate` 写成 `new Date().toISOString()`
- 最终类型被推断冲突，出现 `string is not assignable to Date`

根因：

- 页面没有定义“客户端传输用”的稳定 ViewModel
- 直接把服务端 note entry 改造一半就下发给 `<script define:vars>`

优雅处理方案：

在下发给前端之前，显式建立一个客户端模型，例如：

```ts
interface NoteListItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  relativeDate: string;
  timestamp: number | null;
}
```

然后：

- 服务端统一序列化成纯 JSON 安全字段
- 客户端只消费 `timestamp: number | null`
- 不再在客户端脚本里碰 `Date | string` 联合类型

推荐实现方向：

1. 把 `notesData` 生成逻辑抽成 `serializeNoteListItem(entry)`
2. 输出：
   - `relativeDate`
   - `timestamp`
3. mock data 也严格遵守相同结构

这样不仅能修掉当前 2 个错误，也能让搜索/排序逻辑更稳定。

## 为什么这些方案更“优雅”

这里的“优雅”不是“改动最少”，而是：

- 修一处能消一簇错误
- 把类型约束前移到数据边界
- 避免页面重复写兜底逻辑
- 让内容 schema、工具函数、页面三层说的是同一种数据语言

当前 24 个错误里，最值得避免的反模式有三个：

1. 到处加 `as any`
2. 到处加 `!` 非空断言
3. 在页面层重复写“如果没 title 就 fallback、如果没 date 就 new Date()”

这些都能让检查暂时绿，但会继续放大后续维护成本。

## 推荐处理顺序

### 第一批：先修数据边界

目标：

- 一次性消掉最多的重复错误

顺序：

1. Asset 详情页 entry 类型收窄
2. Notes 日期 helper 统一
3. Notes 列表页客户端 ViewModel 明确化

预期收益：

- 可一次性消掉 `12 + 4 + 2 = 18` 个错误

### 第二批：修共享 UI 契约

顺序：

1. Resume 共享类型抽离
2. NotesSidebar 改为走统一 helper

预期收益：

- 再消掉剩余 `5 + 1 = 6` 个错误

## 建议的落地任务拆分

### Task 1. Content 类型统一

- 用 `CollectionEntry<'notes'>` 替代过宽的自定义 notes entry
- 评估 `src/types/notes.ts` 是否仍有必要保留手写 `NoteCollectionEntry`

### Task 2. Asset 页面类型收窄

- 为资产页引入 `AssetNoteEntry`
- 把 6 个 `[assetId].astro` 页的 props 改为窄类型

### Task 3. 日期模型统一

- 增加内容日期 helper
- 把 notes detail/list 页都切到 `created/updated`

### Task 4. 客户端序列化模型统一

- 为 discover / notes 列表页定义 JSON-safe view model
- 避免在 `<script define:vars>` 里继续让 TS 猜复杂联合类型

### Task 5. Resume 类型共享

- 抽离 `ResumeIcon` / `ContactItem`
- 页面数据用 `satisfies` 约束

### Task 6. 清理 hints

这不是 24 个 error 的主体，但在 error 清完后建议顺手做：

- `Github` 替换为 lucide 新图标名
- 无用 import / 无用变量清理
- `define:vars` 脚本显式 `is:inline` 或改为 JSON script 模式

## 结论

这 24 个错误的最优解不是“逐个修页面”，而是：

- 先统一 content entry 类型
- 再统一日期与客户端序列化模型
- 最后清共享组件契约

如果按上面的顺序处理，这批问题可以在不引入 `any` 和不滥用非空断言的前提下，被比较干净地压平。

