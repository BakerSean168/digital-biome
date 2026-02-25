/**
 * remark-normalize-code-lang.ts
 *
 * 将 Obsidian / 用户常用的非标准代码块语言标识符规范化为 Shiki 支持的别名，
 * 避免 "[Shiki] The language X doesn't exist" 警告并使语法高亮正常工作。
 *
 * 对于完全无法映射的 Obsidian 专有语言（如 dataview），
 * 保留原名并由 Shiki 回退到 plaintext 即可（不报 warning 需要显式添加空语言定义，
 * 但静默降级已足够，此处不处理）。
 */

import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { Code, Root } from 'mdast';

/** 语言名称标准化映射表（不区分大小写） */
const LANG_ALIASES: Record<string, string> = {
  // 大小写变体
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  bash: 'bash',
  shell: 'sh',
  powershell: 'ps1',
  pwsh: 'ps1',
  json: 'json',
  json5: 'json5',
  yaml: 'yaml',
  toml: 'toml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  markdown: 'md',
  rust: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  sql: 'sql',
  dockerfile: 'dockerfile',
  nginx: 'nginx',
  xml: 'xml',
  vue: 'vue',
  jsx: 'jsx',
  tsx: 'tsx',

  // 用户常犯的大写变体（来自 Obsidian 笔记）
  'config.yaml': 'yaml',
  'config.json': 'json',
  gitignore: 'bash',   // .gitignore 文件内容按 shell 高亮
  dotenv: 'bash',
  env: 'bash',

  // Obsidian 专有 / 无对应语言 → 回退到 plaintext 但避免 warning
  // （Shiki 会对未知语言报 warning，设为 plaintext 可静默）
  dataview: 'plaintext',
  dataviewjs: 'js',
  tasks: 'plaintext',
  excalidraw: 'plaintext',
  mermaid: 'mermaid',
};

const remarkNormalizeCodeLang: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'code', (node: Code) => {
      if (!node.lang) return;
      const normalized = LANG_ALIASES[node.lang.toLowerCase()];
      if (normalized) {
        node.lang = normalized;
      }
    });
  };
};

export default remarkNormalizeCodeLang;
