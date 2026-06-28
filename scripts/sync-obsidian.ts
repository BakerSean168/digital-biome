/**
 * Obsidian 同步脚本 — 兼容入口
 *
 * 内部实现已拆分到 scripts/sync/ 模块。
 * 外部命令不变：pnpm sync
 *
 * 使用：
 *   pnpm sync                    (默认同步)
 *   pnpm sync -- --with-favicons (含 favicon 缓存)
 *   pnpm sync -- --dry-run       (预览模式)
 */

import { runSync } from './sync/index';

const args = process.argv.slice(2);
const withFavicons = args.includes('--with-favicons');
const dryRun = args.includes('--dry-run');

try {
  const errorCount = await runSync({ withFavicons, dryRun });
  if (errorCount > 0) {
    console.error(`\nSync completed with ${errorCount} error(s).`);
    process.exit(1);
  }
} catch (err) {
  console.error('Sync failed:', err);
  process.exit(1);
}
