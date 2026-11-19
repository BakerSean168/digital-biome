/**
 * 笔记仓库配置文件
 *
 * 默认读取由 committed `knowledge-public-v1` lock 验证并物化的只读 source。
 * 本地确需直接读取私有 Thought Forest 时，显式设置 `NOTES_VAULT_ROOT`。
 */

const DEFAULT_VAULT_ROOT = '.pds-runtime/knowledge-public-v1/source';
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
    /** 常规知识笔记目录 */
    notesPath: vaultPath('notes'),

    /**
     * 资产笔记目录 (assets/services, assets/subscriptions, assets/hosts...)
     */
    assetNotesPath: vaultPath('assets'),
    projectsPath: vaultPath('projects'),
    usesPath: vaultPath('uses'),

    /**
     * Dashboard 等配置文件目录（同步到 obsidian/config/ 子目录）
     */
    configPath: vaultPath('config'),

    /** 公开投影中的媒体目录。 */
    mediaPath: vaultPath('sources/attachments'),

    /** 博客文章目录 (<selected-source>/blogs) */
    blogsPath: vaultPath('blogs'),

    /** Optional special pages in the private Vault (from the public projection). */
    pagesPath: vaultPath('pages'),

    /** 要包含的文件模式 */
    include: ['**/*.md'],

    /** 要排除的文件/目录模式 */
    exclude: ['**/.git/**', '**/node_modules/**', '**/.obsidian/**', '**/.trash/**'],
  },

  output: {
    /** 同步后的输出目录 */
    notes: 'src/data/obsidian',

    /** 图片资源输出目录（相对于 public/）— served as /vault-assets/<filename> */
    assets: 'public/vault-assets',
  },

  /**
   * Selected producer source generated/ directory config.
   * Contains pre-built knowledge-index JSON files from the verified public projection.
   * Explicit external Thought Forest roots are development-only compatibility inputs;
   *
   * generatedPath is resolved automatically (see resolveUpstreamGeneratedPath above).
   * Override with NOTES_UPSTREAM_GENERATED env var if needed.
   */
  upstream: {
    generatedPath: upstreamGenerated,
  },
};
