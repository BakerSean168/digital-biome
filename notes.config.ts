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
    /** 常规知识笔记目录 */
    notesPath: ['D:/home/thought-forest/z', 'thought-forest/z'],

    /**
     * 资产笔记目录。
     * 当前与图片资源共用 thought-forest/assets 根目录：
     * - 顶层文件主要是图片/附件
     * - services/ tools/ hosts/ network/ 等子目录用于资产笔记
     */
    assetNotesPath: ['D:/home/thought-forest/assets', 'thought-forest/assets'],

    /**
     * Dashboard 等配置文件目录（同步到 obsidian/config/ 子目录）
     * 这里的文件会被同步到 output.notes/config/ 以供内容集合读取
     */
    configPath: ['D:/home/thought-forest/config', 'thought-forest/config'],

    /** 图片/附件资源目录（Obsidian vault 的 assets 文件夹） */
    mediaPath: ['D:/home/thought-forest/assets', 'thought-forest/assets'],
    
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
    notes: 'src/data/obsidian',

    /** 图片资源输出目录（相对于 public/）— served as /vault-assets/<filename> */
    assets: 'public/vault-assets',
  },
};
