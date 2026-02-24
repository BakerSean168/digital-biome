/**
 * Obsidian 同步脚本 (简化版)
 * 功能：将 vault/z/ 中的 .md 文件复制到 src/content/wiki/obsidian
 * 
 * 使用：
 *   pnpm exec tsx scripts/sync-obsidian.ts
 * 
 * 你的笔记已经有完整的 frontmatter，无需修改
 */

import fs from 'fs';
import path from 'path';

const VAULT_PATH = path.join(process.cwd(), 'vault', 'z');
const WIKI_DEST = path.join(process.cwd(), 'src', 'content', 'wiki', 'obsidian');

interface SyncStats {
  copied: number;
  skipped: number;
  errors: string[];
}

/**
 * 递归复制所有 .md 文件
 */
function syncFiles(srcDir: string, destDir: string, stats: SyncStats): void {
  if (!fs.existsSync(srcDir)) {
    console.error(`❌ Vault 目录不存在: ${srcDir}`);
    return;
  }

  // 创建目标目录
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs.readdirSync(srcDir);

  files.forEach(file => {
    // 跳过系统文件和隐藏文件
    if (file.startsWith('.') || file === 'node_modules') return;

    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    const stats_obj = fs.statSync(srcPath);

    if (stats_obj.isDirectory()) {
      // 递归处理子目录
      syncFiles(srcPath, destPath, stats);
    } else if (file.endsWith('.md')) {
      try {
        // 直接复制，保留原有的 frontmatter
        const content = fs.readFileSync(srcPath, 'utf-8');
        fs.writeFileSync(destPath, content, 'utf-8');
        stats.copied++;
        console.log(`✓ ${path.relative(VAULT_PATH, srcPath)}`);
      } catch (err) {
        stats.errors.push(`${file}: ${err}`);
      }
    }
  });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🔄 开始同步 Obsidian 笔记...\n');

  const stats: SyncStats = { copied: 0, skipped: 0, errors: [] };

  try {
    syncFiles(VAULT_PATH, WIKI_DEST, stats);

    console.log(`\n✅ 同步完成！`);
    console.log(`📊 统计：${stats.copied} 个文件复制`);
    console.log(`📁 输出目录: ${WIKI_DEST}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  遇到 ${stats.errors.length} 个错误:`);
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }
  } catch (error) {
    console.error('❌ 同步失败:', error);
    process.exit(1);
  }
}

main();

