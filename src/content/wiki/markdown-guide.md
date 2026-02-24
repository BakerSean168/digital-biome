---
title: Markdown 语法指南
description: 常用 Markdown 语法速查
category: 入门
order: 2
tags:
  - markdown
  - 语法
created: 2026-01-17
---

# Markdown 语法指南

本文介绍知识库中支持的 Markdown 语法。

## 标题

```markdown
# 一级标题
## 二级标题
### 三级标题
```

## 文本格式

- **粗体**：`**粗体**`
- *斜体*：`*斜体*`
- ~~删除线~~：`~~删除线~~`
- `行内代码`：`` `代码` ``

## 列表

### 无序列表

```markdown
- 项目 1
- 项目 2
  - 子项目
```

### 有序列表

```markdown
1. 第一步
2. 第二步
3. 第三步
```

## 链接和图片

```markdown
[链接文字](https://example.com)
![图片描述](image.png)
```

## 代码块

````markdown
```javascript
const greeting = 'Hello, World!';
console.log(greeting);
```
````

效果：

```javascript
const greeting = 'Hello, World!';
console.log(greeting);
```

## 引用

```markdown
> 这是一段引用文字
```

> 这是一段引用文字

## 表格

```markdown
| 标题 1 | 标题 2 |
| ------ | ------ |
| 内容 1 | 内容 2 |
```

| 标题 1 | 标题 2 |
| ------ | ------ |
| 内容 1 | 内容 2 |

## 分割线

```markdown
---
```

---

## 任务列表

```markdown
- [x] 已完成
- [ ] 待完成
```

- [x] 已完成
- [ ] 待完成
