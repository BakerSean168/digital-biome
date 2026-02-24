/**
 * 极简方案：直接让 Astro 读取 vault 中的笔记
 * 在项目 astro.config.mjs 中使用虚拟 module
 * 
 * 这样 src/content/wiki 会同时包含：
 * 1. src/content/wiki/ (本地笔记)
 * 2. vault/z/ (Git submodule 中的 Obsidian 笔记)
 * 
 * 两个目录完全独立，互不影响
 */

// 这个文件其实不需要内容，只是作为说明
// Astro 5.x 会自动读取所有在 src/content/* 下的文件
// 我们只需要确保路径配置正确

console.log(`
✅ Astro Content Collections 配置说明

Astro 会自动读取以下位置的笔记：

1️⃣  本地笔记 (优先级高)
   src/content/wiki/**/*.md
   src/content/blog/**/*.md

2️⃣  Obsidian submodule (需要手动关联)
   vault/z/**/*.md

如果你想让 Astro 同时读取两个位置，有两种方法：

【方法 A】虚拟 Module (推荐，Astro 5.x+)
  - 在 astro.config.mjs 中配置虚拟 module
  - Astro 会自动合并两个路径的内容
  
【方法 B】符号链接 (简单粗暴)
  - ln -s ../../vault/z src/content/wiki/obsidian
  - 或在 Windows 上：mklink /D src\\content\\wiki\\obsidian ..\\..\\vault\\z

【推荐】你现在的做法
  - 在 src/pages/wiki/[...slug].astro 中
  - 同时调用 getCollection('wiki') 和 getCollection('custom')
  - 或创建一个虚拟 collection 指向 vault 目录

下一步：
1. git submodule add <你的-vault-repo> vault
2. 在 pages 中修改查询逻辑
3. 删除 scripts/sync-obsidian.ts (不需要了)
`);
