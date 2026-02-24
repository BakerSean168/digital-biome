# Project Specification: Digital Biome

**Feature Branch**: `001-project-core`  
**Created**: 2026-02-22  
**Status**: Draft  
**Type**: Project-level Specification  

## Project Overview

Digital Biome 是一个个人站点，以 Obsidian 笔记作为单一数据源，通过 Git Submodule 接入，构建三个核心模块：起始页导航、笔记花园、简历页。

**核心原则**：
- Obsidian 作为 Single Source of Truth
- 纯静态构建，部署于 Netlify
- 数据从笔记 frontmatter 动态提取

---

## User Scenarios & Testing

### User Story 1 - 浏览器起始页导航 (Priority: P1)

作为用户，我希望有一个浏览器起始页，自动从我的 Obsidian 笔记中提取书签链接，按分类展示。

**Why this priority**: 这是网站的核心入口，替代传统书签管理，实现"笔记即数据"理念。

**Independent Test**: 访问根路径 `/`，能看到从笔记中提取的书签，按标签分类显示。

**Acceptance Scenarios**:

1. **Given** 笔记中有带 `url` 属性和 `website/video` 标签的文件，**When** 访问起始页，**Then** 显示 Video 分类区块，包含对应链接
2. **Given** 笔记中没有符合条件的书签，**When** 访问起始页，**Then** 显示空状态提示
3. **Given** 同一笔记有多个分类标签，**When** 访问起始页，**Then** 链接在多个分类中重复出现

---

### User Story 2 - 笔记花园浏览 (Priority: P1)

作为读者，我希望浏览站长的 Obsidian 知识库，能搜索和筛选笔记，支持双链跳转。

**Why this priority**: 知识分享是站点核心价值，双链支持是 Obsidian 特色。

**Independent Test**: 访问 `/wiki` 路由，能浏览笔记列表，点击双链能跳转到对应笔记。

**Acceptance Scenarios**:

1. **Given** 笔记库中有多个分类，**When** 访问笔记花园，**Then** 显示分类导航和笔记列表
2. **Given** 笔记中包含 `[[其他笔记]]` 双链，**When** 渲染该笔记，**Then** 双链变为可点击链接
3. **Given** 笔记中包含 `[[笔记名|自定义文本]]` 双链，**When** 渲染该笔记，**Then** 链接显示为"自定义文本"
4. **Given** 用户输入搜索关键词，**When** 执行搜索，**Then** 按标题和标签过滤笔记列表

---

### User Story 3 - 个人主页 (Priority: P2)

作为访客，我希望在主页看到站长的简介、最近更新的笔记、以及导航入口。

**Why this priority**: 主页是门面，但内容来自其他模块，依赖关系明确。

**Independent Test**: 访问 `/home` 路由，能看到个人介绍和最近笔记。

**Acceptance Scenarios**:

1. **Given** 笔记库有最近更新的笔记，**When** 访问主页，**Then** 显示最近 5 篇笔记
2. **Given** 主页已配置，**When** 访问，**Then** 显示导航入口链接到起始页、笔记花园、简历

---

### User Story 4 - 在线简历 (Priority: P2)

作为面试官/甲方，我希望看到一个排版清晰的在线简历，方便打印。

**Why this priority**: 简历是个人品牌展示，但属于独立模块，不影响核心功能。

**Independent Test**: 访问 `/resume` 路由，能查看简历并打印。

**Acceptance Scenarios**:

1. **Given** 简历数据已配置，**When** 访问简历页，**Then** 显示结构化简历内容
2. **Given** 用户点击打印，**When** 执行打印，**Then** 页面使用打印优化样式
3. **Given** 简历数据来源为 Markdown 文件，**When** 更新该文件，**Then** 构建后简历内容更新

---

### Edge Cases

- 笔记文件缺少必需 frontmatter 字段时，使用合理默认值（如 `title` 从文件名推断）
- Git Submodule 未初始化或更新失败时，构建失败并输出明确错误信息
- 双链指向不存在的笔记时，显示为带视觉提示的文本（虚线样式或问号图标），不可点击
- 标签分类冲突（如同时有 `website/video` 和 `website/tool`）时，链接在多个分类中重复出现

---

## Requirements

### Functional Requirements

#### 数据层

- **FR-001**: 系统 MUST 通过 Git Submodule 引入 Obsidian 笔记仓库到 `src/content/notes`
- **FR-002**: 系统 MUST 在构建时解析所有 Markdown 文件的 frontmatter
- **FR-003**: 系统 MUST 支持 YAML 格式的 frontmatter 解析
- **FR-004**: 系统 MUST 过滤 `draft: true` 或 `private: true` frontmatter 的笔记，不发布到站点

#### 起始页模块

- **FR-010**: 系统 MUST 遍历笔记，筛选出包含 `url` 属性且带有 `type/resource` 类标签的文件作为书签
- **FR-011**: 系统 MUST 根据 `website/*` 标签自动生成分类区块
- **FR-012**: 系统 MUST 提取笔记的 `title`、`url`、`description` 作为书签展示信息
- **FR-013**: 系统 MUST 支持同一链接出现在多个分类区块
- **FR-014**: 书签笔记同时也是 Wiki 笔记的一部分，可在笔记花园中浏览

#### 笔记花园模块

- **FR-020**: 系统 MUST 渲染 Markdown 内容为 HTML
- **FR-021**: 系统 MUST 解析 `[[笔记名]]` 和 `[[笔记名|显示文本]]` 双链语法并转换为内部链接
- **FR-022**: 系统 MUST 提供按标题的搜索功能
- **FR-023**: 系统 MUST 提供按标签的筛选功能
- **FR-024**: 系统 MUST 生成分类导航结构

#### 主页模块

- **FR-030**: 系统 MUST 展示个人简介
- **FR-031**: 系统 MUST 展示最近更新的 5 篇笔记，按 Git 文件最后修改时间排序
- **FR-032**: 系统 MUST 提供到其他模块的导航入口

#### 简历模块

- **FR-040**: 系统 MUST 从 Markdown/YAML 文件读取简历数据
- **FR-041**: 系统 MUST 提供打印优化的 CSS 样式
- **FR-042**: 系统 MUST 按时间轴布局展示工作经历

### Key Entities

| Entity    | Description          | Key Attributes                                                |
|-----------|----------------------|---------------------------------------------------------------|
| Note      | Obsidian 笔记文件    | title, url, tags, description, content, category, draft       |
| Bookmark  | 从笔记提取的书签     | title, url, description, category (Note 的视图)               |
| Category  | 自动生成的分类       | name (来自标签), bookmarks                                     |
| WikiLink  | 双链引用             | source, target, displayText                                   |

**Note 与 Bookmark 关系**: Bookmark 是 Note 的一种展示视图。当 Note 包含 `url` 和 `type/resource` 标签时，可在起始页以 Bookmark 形式展示；同时该 Note 仍作为 Wiki 文章在笔记花园中可见。

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 起始页在 1 秒内完成加载，展示所有分类书签
- **SC-002**: 笔记花园支持搜索 1000+ 篇笔记，搜索响应时间 < 500ms
- **SC-003**: 双链解析准确率 100%，无死链
- **SC-004**: 简历页打印输出符合 A4 纸排版标准
- **SC-005**: 构建时间在 100 篇笔记规模下 < 60 秒

### Quality Metrics

- **SC-010**: 所有页面通过 Core Web Vitals 检测
- **SC-011**: 移动端适配，支持 375px-1440px 屏幕宽度
- **SC-012**: 无 JavaScript 情况下，基础导航和阅读功能可用

---

## Assumptions

1. Obsidian 笔记仓库使用标准 Markdown 格式，frontmatter 为 YAML
2. 用户已配置 Git Submodule 并有权限访问笔记仓库
3. 笔记标签体系遵循 `type/*`, `source/*`, `website/*` 命名规范
4. 搜索功能使用客户端实现（预生成 JSON 索引）

---

## Decisions

1. **主页路由**: 主页独立为 `/home`，根路径 `/` 为书签起始页导航
2. **双链语法**: 支持 `[[笔记名]]` 和 `[[笔记名|显示文本]]` 两种语法

## Clarifications

### Session 2026-02-22

- Q: 私有笔记如何处理？ → A: 过滤 `draft: true` 或 `private: true` frontmatter 的笔记
- Q: 双链指向不存在的笔记时如何显示？ → A: 显示为带视觉提示的文本（如虚线样式或问号图标）
- Q: "最近更新的笔记"排序依据？ → A: 使用 Git 文件最后修改时间
- Q: Git Submodule 失败时如何处理？ → A: 构建失败，输出明确错误信息
- Q: 书签笔记与 Wiki 笔记的关系？ → A: 同一笔记可兼具两种角色，有 url 则为书签，始终在 Wiki 可见

---

## Out of Scope

- 在线编辑笔记功能
- 用户评论系统
- 访问统计
- RSS 订阅
- 多语言支持
