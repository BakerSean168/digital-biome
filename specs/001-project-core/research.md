# Research: Digital Biome Project Core

**Date**: 2026-02-22  
**Feature**: 001-project-core

## 1. Obsidian 双链语法解析

### 决策: 自定义 remark 插件

**Rationale**: 
- Astro 使用 remark/rehype 管道处理 Markdown
- 自定义插件可精确控制双链转换逻辑
- 无需引入额外的依赖库

**实现方案**:
```typescript
// src/utils/remark-wikilinks.ts
// 匹配模式: [[笔记名]] 或 [[笔记名|显示文本]]
// 转换为: <a href="/wiki/笔记名">显示文本或笔记名</a>
```

**Alternatives Considered**:
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| obsidian-dataview | 功能强大 | 重型，不适合静态站点 | 拒绝 |
| markdown-it-wikilinks | 开箱即用 | 不兼容 Astro 的 remark 管道 | 拒绝 |
| 自定义 remark 插件 | 轻量、可控 | 需要开发 | 采用 |

---

## 2. 静态站点搜索方案

### 决策: Pagefind

**Rationale**:
- Astro 官方集成支持
- 构建时生成索引，零运行时开销
- 支持中文分词
- 体积小 (~10KB gzipped)

**实现方案**:
```bash
pnpm add @pagefind/default-ui
```

```typescript
// 构建后自动生成索引
// 在 Wiki 页面引入搜索组件
```

**Alternatives Considered**:
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| Algolia | 功能强大 | 需要付费，外部依赖 | 拒绝 |
| Lunr.js | 轻量 | 需要手动构建索引 | 拒绝 |
| FlexSearch | 快速 | 中文支持一般 | 拒绝 |
| Pagefind | Astro 原生，静态友好 | - | 采用 |

---

## 3. Git Submodule 处理

### 决策: 构建时脚本 + 错误中断

**Rationale**:
- Netlify 支持在构建时初始化 Submodule
- 错误时构建失败，符合 spec 要求
- 无需额外的 CI/CD 配置

**实现方案**:
```toml
# netlify.toml
[build]
  command = "git submodule update --init --recursive && pnpm build"
```

**Netlify 配置**:
- 在 Netlify Dashboard 设置 Submodule 仓库访问权限 (Deploy Key)
- 或使用 Git Token 认证

---

## 4. 笔记过滤策略

### 决策: Content Collections Schema 过滤

**Rationale**:
- 利用 Astro 原生的 Content Collections 能力
- 在 schema 中定义 `draft` 和 `private` 字段
- 查询时自动过滤

**实现方案**:
```typescript
// src/content/config.ts
const wiki = defineCollection({
  schema: z.object({
    draft: z.boolean().default(false),
    private: z.boolean().default(false),
    // ...
  })
});

// 查询时过滤
const notes = (await getCollection('wiki'))
  .filter(note => !note.data.draft && !note.data.private);
```

---

## 5. 书签提取策略

### 决策: 构建时从笔记 frontmatter 提取

**Rationale**:
- 符合 "Single Source of Truth" 原则
- 避免维护两套数据源
- 构建时处理，无运行时开销

**实现方案**:
```typescript
// src/utils/bookmarks.ts
export async function getBookmarks() {
  const notes = await getCollection('wiki');
  
  return notes
    .filter(note => 
      note.data.url && 
      note.data.tags?.includes('type/resource')
    )
    .map(note => ({
      title: note.data.title,
      url: note.data.url,
      description: note.data.description,
      categories: note.data.tags
        .filter(t => t.startsWith('website/'))
        .map(t => t.replace('website/', ''))
    }));
}
```

---

## 6. 分类导航生成

### 决策: 从标签自动推断

**Rationale**:
- 利用现有的标签体系 (`website/*`)
- 无需额外配置
- 自动更新

**实现方案**:
```typescript
// 从所有笔记的 website/* 标签提取分类
const categories = new Set<string>();
notes.forEach(note => {
  note.data.tags?.forEach(tag => {
    if (tag.startsWith('website/')) {
      categories.add(tag.replace('website/', ''));
    }
  });
});
```

---

## 7. Git 文件修改时间获取

### 决策: 使用 git log 命令

**Rationale**:
- 准确反映实际修改时间
- 不依赖文件系统时间
- 可在构建时获取

**实现方案**:
```typescript
// 构建时脚本
import { execSync } from 'child_process';

function getGitLastModified(filePath: string): Date {
  const result = execSync(
    `git log -1 --format="%ct" -- ${filePath}`
  ).toString().trim();
  return new Date(parseInt(result) * 1000);
}
```

**注意**: Netlify 构建环境需要完整 Git 历史，需在 `netlify.toml` 中配置。

---

## 8. 打印样式优化

### 决策: CSS @media print

**Rationale**:
- 原生 CSS 支持
- 无额外依赖
- 可精确控制打印布局

**实现方案**:
```css
@media print {
  .no-print { display: none; }
  .page-break { page-break-before: always; }
  body { font-size: 12pt; }
  /* A4 纸张优化 */
  @page { size: A4; margin: 2cm; }
}
```

---

## 依赖清单

| 依赖 | 用途 | 状态 |
|------|------|------|
| Astro 5.x | 框架 | 已安装 |
| @astrojs/netlify | 部署适配器 | 已安装 |
| @pagefind/default-ui | 搜索 | 待安装 |
| remark-wikilinks (自定义) | 双链解析 | 待开发 |

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Git Submodule 权限问题 | 构建失败 | 文档说明 Deploy Key 配置 |
| 大量笔记构建时间过长 | 部署延迟 | 增量构建、缓存优化 |
| 双链解析边缘情况 | 功能缺陷 | 充分的单元测试 |
