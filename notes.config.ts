/**
 * 笔记仓库配置文件
 *
 * 默认读取仓库内的 `thought-forest` 子模块，保证本地与 CI/CD 数据源一致。
 * 如需临时指向外部 vault，可显式设置 `NOTES_VAULT_ROOT` 环境变量。
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_VAULT_ROOT = 'thought-forest';
const vaultRoot = process.env.NOTES_VAULT_ROOT?.trim() || DEFAULT_VAULT_ROOT;

function vaultPath(...segments: string[]): string {
  return [vaultRoot, ...segments].join('/');
}

/**
 * Resolve the path to the upstream thought-forest/generated/ directory.
 *
 * The git submodule at `thought-forest/` has `generated/` in its .gitignore,
 * so the generated files (knowledge-index/*.json) only exist in the full local
 * clone of the thought-forest repo.
 *
 * Resolution priority:
 *   1. NOTES_UPSTREAM_GENERATED env var (explicit override for CI or custom setups)
 *   2. {vaultRoot}/generated — works when `kb:index` was run inside the submodule
 *   3. ../thought-forest/generated — sibling clone of thought-forest (local dev default)
 *   4. Fallback to {vaultRoot}/generated (merge/copy steps will skip gracefully)
 */
function resolveUpstreamGeneratedPath(): string {
  if (process.env.NOTES_UPSTREAM_GENERATED?.trim()) {
    return process.env.NOTES_UPSTREAM_GENERATED.trim();
  }
  const candidates = [
    `${DEFAULT_VAULT_ROOT}/generated`,
    '../thought-forest/generated',
    '../../thought-forest/generated',
  ];
  const cwd = process.cwd();
  for (const candidate of candidates) {
    const resolved = path.resolve(cwd, candidate);
    if (fs.existsSync(path.join(resolved, 'knowledge-index'))) {
      return candidate;
    }
  }
  return `${DEFAULT_VAULT_ROOT}/generated`;
}

const upstreamGenerated = resolveUpstreamGeneratedPath();

export const notesConfig = {
  vault: {
    /** 常规知识笔记目录 */
    notesPath: vaultPath('z'),

    /**
     * 资产笔记目录。
     * 当前与图片资源共用 thought-forest/assets 根目录：
     * - 顶层文件主要是图片/附件
     * - services/ tools/ hosts/ network/ 等子目录用于资产笔记
     */
    assetNotesPath: vaultPath('assets'),

    /**
     * Dashboard 等配置文件目录（同步到 obsidian/config/ 子目录）
     * 这里的文件会被同步到 output.notes/config/ 以供内容集合读取
     */
    configPath: vaultPath('config'),

    /** 图片/附件资源目录（Obsidian vault 的 assets 文件夹） */
    mediaPath: vaultPath('assets'),

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
