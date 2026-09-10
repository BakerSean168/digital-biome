import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { NotesIndex } from '../../src/types/knowledge-index';
import { parseMarkdownFrontmatter, frontmatterBoolean } from '../../src/domain/markdown/frontmatter';

function walkMarkdown(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walkMarkdown(full) : entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

test('quoted/private and draft frontmatter can only narrow publication', () => {
  const notesRoot = path.join(process.cwd(), 'src/data/obsidian');
  const indexPath = path.join(process.cwd(), 'src/data/indexes/notes-index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as NotesIndex;
  const byFile = new Map(index.entries.map(entry => [entry.filePath.replace(/\\/g, '/'), entry]));

  let protectedByLocalFrontmatter = 0;
  for (const file of walkMarkdown(notesRoot)) {
    const relative = path.relative(notesRoot, file).replace(/\\/g, '/');
    const { data } = parseMarkdownFrontmatter(fs.readFileSync(file, 'utf8'), relative);
    const localPrivate = frontmatterBoolean(data.private);
    const localDraft = frontmatterBoolean(data.draft);
    if (!localPrivate && !localDraft) continue;

    protectedByLocalFrontmatter += 1;
    const entry = byFile.get(relative);
    assert.ok(entry, `${relative} must exist in notes-index`);
    if (localPrivate) {
      assert.equal(entry.private, true, `${relative} private flag must survive local projection`);
      assert.notEqual(entry.visibility, 'public', `${relative} must not be widened to public`);
    }
    if (localDraft) assert.equal(entry.draft, true, `${relative} draft flag must survive local projection`);
  }

  assert.ok(protectedByLocalFrontmatter > 0, 'expected at least one locally protected note fixture/current note');
});
