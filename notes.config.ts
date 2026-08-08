/**
 * 笔记仓库配置文件
 *
 * 默认读取仓库内的 `thought-forest` 子模块，保证本地与 CI/CD 数据源一致。
 * 如需临时指向外部 vault，可显式设置 `NOTES_VAULT_ROOT` 环境变量。
 */

const DEFAULT_VAULT_ROOT = 'thought-forest';
const vaultRoot = process.env.NOTES_VAULT_ROOT?.trim() || DEFAULT_VAULT_ROOT;

function vaultPath(...segments: string[]): string {
  return [vaultRoot, ...segments].join('/');
}

/**
 * Default to the generated index beside the selected Vault. Never search parent
 * directories: doing so makes a build depend on an unrelated local clone.
 * NOTES_UPSTREAM_GENERATED remains an explicit development-only escape hatch.
 */
function resolveUpstreamGeneratedPath(): string {
  if (process.env.NOTES_UPSTREAM_GENERATED?.trim()) {
    return process.env.NOTES_UPSTREAM_GENERATED.trim();
  }
  return `${vaultRoot}/generated`;
}

const upstreamGenerated = resolveUpstreamGeneratedPath();

export const notesConfig = {
  vault: {
    /** 常规知识笔记目录 (z/) */
    notesPath: vaultPath('z'),

    /**
     * 资产笔记目录 (assets/services, assets/subscriptions, assets/hosts...)
     */
    assetNotesPath: vaultPath('assets'),

    /**
     * Dashboard 等配置文件目录（同步到 obsidian/config/ 子目录）
     */
    configPath: vaultPath('config'),

    /** 二进制附件与媒体资源目录 (attachments/images) */
    mediaPath: vaultPath('attachments/images'),

    /** 博客文章目录 (thought-forest/blogs) */
    blogsPath: vaultPath('blogs'),

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

  /**
   * Upstream thought-forest generated/ directory config.
   * Contains pre-built knowledge-index JSON files produced by `npm run kb:index`.
   *
   * generatedPath is resolved automatically (see resolveUpstreamGeneratedPath above).
   * Override with NOTES_UPSTREAM_GENERATED env var if needed.
   */
  upstream: {
    generatedPath: upstreamGenerated,
  },
};
