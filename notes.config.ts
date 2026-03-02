/**
 * 笔记仓库配置文件
 * 
 * 用法：
 * - vault.path: 笔记仓库的路径（可以是 submodule 或本地目录）
 * - vault.assets: 图片资源目录（相对于项目根目录）
 * - vault.include: 要包含的文件模式
 * - vault.exclude: 要排除的文件模式
 * - output.notes: 同步输出目录
 * - output.assets: 图片资源同步输出目录（相对于 public/）
 */

export const notesConfig = {
  vault: {
    /** 笔记仓库路径，支持相对路径或绝对路径 */
    path: 'thought-forest/z',

    /** 图片资源目录（Obsidian vault 的 assets 文件夹） */
    assets: 'thought-forest/assets',
    
    /** 要包含的文件模式 */
    include: ['**/*.md'],
    
    /** 要排除的文件/目录模式 */
    exclude: [
      '**/.git/**',
      '**/node_modules/**',
      '**/.obsidian/**',
      '**/.trash/**',
    ],
  },
  
  output: {
    /** 同步后的输出目录 */
    notes: 'src/content/notes/obsidian',

    /** 图片资源输出目录（相对于 public/）— served as /vault-assets/<filename> */
    assets: 'public/vault-assets',
  },
};
