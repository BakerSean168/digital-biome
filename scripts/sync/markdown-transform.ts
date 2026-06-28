/**
 * Pure text transforms for markdown content.
 *
 * No file I/O — all functions take a string and return a string.
 */

import path from 'path';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?)$/i;

/**
 * Rewrite local image references to /vault-assets/<filename>.
 *
 * Handles:
 *   1. Obsidian wikilink images: ![[image.png]]
 *   2. Standard markdown images: ![alt](path)
 */
export function rewriteImagePaths(content: string, assetsUrlPrefix: string): string {
  // 1. Obsidian wikilink images
  content = content.replace(
    /!\[\[([^\]]+\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?))\]\]/gi,
    (_match, imgPath: string) => {
      const filename = path.basename(imgPath);
      const alt = filename.replace(/\.[^.]+$/, '');
      return `![${alt}](${assetsUrlPrefix}/${encodeURIComponent(filename)})`;
    }
  );

  // 2. Standard markdown images
  content = content.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_match, alt: string, imgPath: string) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(imgPath);
      } catch {
        decoded = imgPath;
      }
      const filename = path.basename(decoded);
      if (!IMAGE_EXT.test(filename)) {
        return _match;
      }
      return `![${alt}](${assetsUrlPrefix}/${encodeURIComponent(filename)})`;
    }
  );

  return content;
}

/**
 * Rewrite vault-internal .md links to /notes/obsidian/<slug> format.
 */
export function rewriteVaultNoteLinks(content: string): string {
  return content.replace(
    /\[([^\]]+)\]\((?!https?:\/\/)([^)]+\.md)\)/g,
    (match, text: string, notePath: string) => {
      const normalizedPath = notePath.replace(/\\/g, '/');
      const vaultNoteMatch = normalizedPath.match(/(?:^|\/)thought-forest\/z\/(.+)\.md$/i);

      if (!vaultNoteMatch) {
        return match;
      }

      const slug = vaultNoteMatch[1];
      return `[${text}](${encodeURI(`/notes/obsidian/${slug}`)})`;
    }
  );
}

/**
 * Quote YAML scalar values that would be misinterpreted by parsers.
 *
 * YAML values starting with @, `, :, {, [, or containing unquoted colons
 * can cause parse failures. This wraps them in double quotes.
 */
export function quoteYamlSpecialValues(frontmatter: string): string {
  return frontmatter.replace(
    /^(\w[\w_-]*):\s+(@|`|:)(.*)$/gm,
    (_match, key: string, _special: string, rest: string) => {
      // Already quoted — skip
      if (rest.startsWith('"') || rest.startsWith("'")) return _match;
      return `${key}: "${_special}${rest.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
  );
}

/**
 * Detect YAML-unfriendly values in frontmatter and return warnings.
 * Does NOT modify content — only reports risks.
 */
export function detectYamlRisks(frontmatter: string, filename: string): string[] {
  const warnings: string[] = [];
  const riskyPattern = /^(\w[\w_-]*):\s+(@|`|:)(.*)$/gm;
  let match: RegExpExecArray | null;
  while ((match = riskyPattern.exec(frontmatter)) !== null) {
    const key = match[1];
    const rest = match[3];
    // Skip if already quoted
    if (rest.startsWith('"') || rest.startsWith("'")) continue;
    warnings.push(`${filename}: field "${key}" starts with special YAML character — may cause parse failures in consumers`);
  }
  return warnings;
}

/**
 * Normalize frontmatter indentation (remove common leading spaces).
 */
export function normalizeFrontmatterIndentation(frontmatter: string): string {
  const lines = frontmatter.split('\n');
  const indents = lines
    .filter(line => line.trim() !== '')
    .map(line => line.match(/^ */)?.[0].length ?? 0);

  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  if (minIndent === 0) {
    return frontmatter;
  }

  return lines
    .map(line => {
      if (line.trim() === '') return line;
      return line.slice(minIndent);
    })
    .join('\n');
}

/**
 * Process markdown content:
 *   - Add missing frontmatter
 *   - Normalize frontmatter indentation
 *   - Add missing title
 *   - Rewrite image and note links
 */
export function processContent(
  content: string,
  filename: string,
  assetsUrlPrefix: string
): string {
  const baseName = filename.replace(/\.md$/, '');

  let processed: string;

  if (!content.startsWith('---')) {
    // No frontmatter — create minimal and preserve body
    processed = `---\ntitle: "${baseName}"\ntags: []\n---\n\n${content}`;
  } else {
    const lines = content.split('\n');
    let closingIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closingIndex = i;
        break;
      }
      if (/^(#|>|\*|- \[|!\[|\|)/.test(lines[i].trim()) && !lines[i].trim().startsWith('- ')) {
        break;
      }
      if (/^- \[[ x]\]/.test(lines[i].trim())) {
        break;
      }
    }

    if (closingIndex === -1) {
      // Unclosed frontmatter — extract YAML-like lines
      const yamlLines: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || /^[\w"'\/].*:/.test(line) || /^- /.test(line)) {
          yamlLines.push(lines[i]);
        } else {
          break;
        }
      }
      const bodyStart = 1 + yamlLines.length;
      let frontmatter = yamlLines.join('\n');

      frontmatter = normalizeFrontmatterIndentation(frontmatter);
      frontmatter = quoteYamlSpecialValues(frontmatter);

      const hasTitle = /^title:\s/m.test(frontmatter);
      if (!hasTitle) {
        frontmatter = `title: "${baseName}"\n${frontmatter}`;
      }

      const body = lines.slice(bodyStart).join('\n');
      processed = `---\n${frontmatter}\n---\n${body}`;
    } else {
      let frontmatter = lines.slice(1, closingIndex).join('\n');
      const body = lines.slice(closingIndex + 1).join('\n');

      frontmatter = normalizeFrontmatterIndentation(frontmatter);
      frontmatter = quoteYamlSpecialValues(frontmatter);

      const hasTitle = /^title:\s/m.test(frontmatter);
      if (!hasTitle) {
        frontmatter = `title: "${baseName}"\n${frontmatter}`;
      }

      processed = `---\n${frontmatter}\n---\n${body}`;
    }
  }

  return rewriteVaultNoteLinks(rewriteImagePaths(processed, assetsUrlPrefix));
}
