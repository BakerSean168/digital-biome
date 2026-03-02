/**
 * Obsidian 同步脚本
 * 功能：
 *   1. 将 vault 目录中的 .md 文件同步到 wiki 内容目录
 *      - 新增/更新笔记会被复制
 *      - vault 中已删除或重命名的笔记会从目标目录中清理
 *   2. 将 vault/assets/ 目录中的图片复制到 public/vault-assets/
 *      - markdown 中的本地图片路径会被重写为 /vault-assets/<filename>
 *      - Obsidian wikilink 图片语法 ![[name.png]] 也会被转换
 *
 * 使用：
 *   pnpm sync          (通过 package.json script)
 *   pnpm exec tsx scripts/sync-obsidian.ts
 *
 * 配置：
 *   修改 notes.config.ts 中的路径来指定笔记仓库和资源路径
 */

import fs from 'fs';
import path from 'path';
import { notesConfig } from '../notes.config';

const VAULT_PATH = path.join(process.cwd(), notesConfig.vault.path);
const ASSETS_SRC = path.join(process.cwd(), notesConfig.vault.assets);
const NOTES_DEST = path.join(process.cwd(), notesConfig.output.notes);
const ASSETS_DEST = path.join(process.cwd(), notesConfig.output.assets);

// URL prefix used in rewritten markdown image paths
const ASSETS_URL_PREFIX = '/vault-assets';

interface SyncStats {
  copied: number;
  cleaned: number;
  skipped: number;
  assetsCopied: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Image path rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite all local image references in markdown content so they point to
 * /vault-assets/<filename> — the static public directory where we copy images.
 *
 * Handles two syntaxes:
 *   1. Standard markdown:  ![alt text](some/path/image.png)
 *   2. Obsidian wikilink:  ![[image.png]]  or  ![[some/path/image.png]]
 *
 * External URLs (http/https) are left untouched.
 * Only common image extensions are matched to avoid mangling code examples.
 */
function rewriteImagePaths(content: string): string {
  const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?)$/i;

  // 1. Obsidian wikilink images: ![[filename.ext]] or ![[path/filename.ext]]
  //    Convert to standard markdown: ![filename](/vault-assets/filename.ext)
  content = content.replace(
    /!\[\[([^\]]+\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?))\]\]/gi,
    (_match, imgPath: string) => {
      const filename = path.basename(imgPath);
      const alt = filename.replace(/\.[^.]+$/, '');
      return `![${alt}](${ASSETS_URL_PREFIX}/${encodeURIComponent(filename)})`;
    }
  );

  // 2. Standard markdown images: ![alt](path) where path is not http/https
  content = content.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_match, alt: string, imgPath: string) => {
      // Decode percent-encoded paths before extracting basename
      let decoded: string;
      try {
        decoded = decodeURIComponent(imgPath);
      } catch {
        decoded = imgPath;
      }
      const filename = path.basename(decoded);
      if (!IMAGE_EXT.test(filename)) {
        // Not an image extension — leave unchanged (e.g. badge links, etc.)
        return _match;
      }
      return `![${alt}](${ASSETS_URL_PREFIX}/${encodeURIComponent(filename)})`;
    }
  );

  return content;
}

// ---------------------------------------------------------------------------
// Markdown processing
// ---------------------------------------------------------------------------

/**
 * 处理 markdown 内容 - 标准化 frontmatter + 重写图片路径
 * 
 * 保留原始 frontmatter 中的所有字段（tags, created, updated 等），
 * 仅在缺少 title 时补充，修复缩进问题而非丢弃整个 frontmatter。
 */
function processContent(content: string, filename: string): string {
  const baseName = filename.replace(/\.md$/, '');

  let processed: string;

  if (!content.startsWith('---')) {
    // 无 frontmatter，创建最小 frontmatter 并保留原始内容
    processed = `---\ntitle: "${baseName}"\ntags: []\n---\n\n${content}`;
  } else {
    // 查找 frontmatter 闭合标记：必须是行首的 ---
    // 跳过第一行的 ---，从第二行开始查找
    const lines = content.split('\n');
    let closingIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closingIndex = i;
        break;
      }
      // 如果遇到明显不是 YAML 的内容（如 markdown 标题、引用块），
      // 说明 frontmatter 缺少闭合标记
      if (/^(#|>|\*|- \[|!\[|\|)/.test(lines[i].trim()) && !lines[i].trim().startsWith('- ')) {
        break;
      }
      // YAML 列表项 "- value" 是合法的，但独立的 "- [x]" 是 markdown checkbox
      if (/^- \[[ x]\]/.test(lines[i].trim())) {
        break;
      }
    }

    if (closingIndex === -1) {
      // frontmatter 未闭合或无效，提取看起来像 YAML 的行
      const yamlLines: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        // 空行或 YAML 键值对或列表项
        if (line === '' || /^[\w"'\/].*:/.test(line) || /^- /.test(line)) {
          yamlLines.push(lines[i]);
        } else {
          break;
        }
      }
      const bodyStart = 1 + yamlLines.length;
      let frontmatter = yamlLines.join('\n');

      // 修复缩进问题
      const hasIndentationIssue = /^ +\w/m.test(frontmatter);
      if (hasIndentationIssue) {
        frontmatter = frontmatter
          .split('\n')
          .map(line => {
            // 保留 YAML 列表项缩进（如 tags 列表下的 - item）
            if (/^\s+- /.test(line)) return line;
            return line.replace(/^ +/, '');
          })
          .join('\n');
      }

      // 如果缺少 title 字段，添加
      const hasTitle = /^title:\s/m.test(frontmatter);
      if (!hasTitle) {
        frontmatter = `title: "${baseName}"\n${frontmatter}`;
      }

      const body = lines.slice(bodyStart).join('\n');
      processed = `---\n${frontmatter}\n---\n${body}`;
    } else {
      let frontmatter = lines.slice(1, closingIndex).join('\n');
      const body = lines.slice(closingIndex + 1).join('\n');

      // 修复缩进问题
      const hasIndentationIssue = /^ +\w/m.test(frontmatter);
      if (hasIndentationIssue) {
        frontmatter = frontmatter
          .split('\n')
          .map(line => {
            if (/^\s+- /.test(line)) return line;
            return line.replace(/^ +/, '');
          })
          .join('\n');
      }

      // 如果缺少 title 字段，添加
      const hasTitle = /^title:\s/m.test(frontmatter);
      if (!hasTitle) {
        frontmatter = `title: "${baseName}"\n${frontmatter}`;
      }

      processed = `---\n${frontmatter}\n---\n${body}`;
    }
  }

  return rewriteImagePaths(processed);
}

// ---------------------------------------------------------------------------
// File collection helpers
// ---------------------------------------------------------------------------

/**
 * 递归收集目录下所有文件的相对路径
 */
function collectFiles(dir: string, baseDir: string): Set<string> {
  const result = new Set<string>();
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      for (const sub of collectFiles(fullPath, baseDir)) {
        result.add(sub);
      }
    } else {
      result.add(path.relative(baseDir, fullPath));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Asset sync
// ---------------------------------------------------------------------------

/**
 * Copy all files from vault/assets/ to public/vault-assets/
 * (flat copy — no subdirectories expected in assets/)
 */
function syncAssets(stats: SyncStats): void {
  if (!fs.existsSync(ASSETS_SRC)) {
    console.log(`  assets dir not found, skipping: ${ASSETS_SRC}`);
    return;
  }

  if (!fs.existsSync(ASSETS_DEST)) {
    fs.mkdirSync(ASSETS_DEST, { recursive: true });
  }

  const files = fs.readdirSync(ASSETS_SRC);
  for (const file of files) {
    if (file.startsWith('.')) continue;
    const srcPath = path.join(ASSETS_SRC, file);
    const destPath = path.join(ASSETS_DEST, file);

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) continue; // skip nested dirs

    try {
      fs.copyFileSync(srcPath, destPath);
      stats.assetsCopied++;
    } catch (err) {
      stats.errors.push(`asset ${file}: ${err}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Notes sync
// ---------------------------------------------------------------------------

/**
 * 递归复制所有 .md 文件（处理内容后写入）
 */
function syncFiles(srcDir: string, destDir: string, stats: SyncStats): void {
  if (!fs.existsSync(srcDir)) {
    console.error(`Vault 目录不存在: ${srcDir}`);
    console.log(`请在 notes.config.ts 中配置正确的 vault.path`);
    process.exit(1);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs.readdirSync(srcDir);

  for (const file of files) {
    if (file.startsWith('.')) continue;

    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      syncFiles(srcPath, destPath, stats);
    } else if (file.endsWith('.md')) {
      try {
        let content = fs.readFileSync(srcPath, 'utf-8');
        content = processContent(content, file);
        fs.writeFileSync(destPath, content, 'utf-8');
        stats.copied++;
      } catch (err) {
        stats.errors.push(`${file}: ${err}`);
      }
    } else {
      stats.skipped++;
    }
  }
}

// ---------------------------------------------------------------------------
// Stale file cleanup
// ---------------------------------------------------------------------------

/**
 * 清理目标目录中已不存在于 vault 的文件和空目录
 */
function cleanStalledFiles(destDir: string, vaultFiles: Set<string>, stats: SyncStats): void {
  if (!fs.existsSync(destDir)) return;

  // 将 vault 中存在的 .md 文件路径映射到 dest 中的对应路径
  const expectedDestFiles = new Set(
    Array.from(vaultFiles)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(destDir, f))
  );

  const destFiles = collectFiles(destDir, destDir);

  for (const relPath of destFiles) {
    const fullDestPath = path.join(destDir, relPath);
    if (!expectedDestFiles.has(fullDestPath)) {
      try {
        fs.rmSync(fullDestPath, { force: true });
        stats.cleaned++;
        console.log(`  cleaned: ${relPath}`);
      } catch (err) {
        stats.errors.push(`clean ${relPath}: ${err}`);
      }
    }
  }

  // 清理空目录
  removeEmptyDirs(destDir);
}

function removeEmptyDirs(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      removeEmptyDirs(fullPath);
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Syncing Obsidian notes...');
  console.log(`  vault : ${VAULT_PATH}`);
  console.log(`  assets: ${ASSETS_SRC} -> ${ASSETS_DEST}`);
  console.log(`  dest  : ${NOTES_DEST}\n`);

  const stats: SyncStats = { copied: 0, cleaned: 0, skipped: 0, assetsCopied: 0, errors: [] };

  // Copy images to public/vault-assets/
  syncAssets(stats);

  // 收集 vault 中所有文件（用于清理对比）
  const vaultFiles = collectFiles(VAULT_PATH, VAULT_PATH);

  // 清理 dest 中已失效的文件
  cleanStalledFiles(NOTES_DEST, vaultFiles, stats);

  // 同步最新文件（含图片路径重写）
  syncFiles(VAULT_PATH, NOTES_DEST, stats);

  console.log(
    `\nDone: ${stats.copied} notes copied, ${stats.assetsCopied} assets copied, ` +
    `${stats.cleaned} cleaned, ${stats.skipped} skipped`
  );

  if (stats.errors.length > 0) {
    console.warn(`\nWarnings (${stats.errors.length}):`);
    stats.errors.forEach(err => console.warn(`  - ${err}`));
  }
}

main();
