import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const layout = readFileSync(fileURLToPath(new URL('./NotesLayout.astro', import.meta.url)), 'utf8');
const notePage = readFileSync(
  fileURLToPath(new URL('../pages/notes/[...slug].astro', import.meta.url)),
  'utf8',
);

test('notes list does not render empty graph or outline columns', () => {
  assert.match(layout, /const showContext = Boolean\(currentSlug\)/);
  assert.match(layout, /const showOutline = showContext && showToc/);
  assert.match(layout, /\{showContext && \(/);
  assert.match(layout, /\{showOutline && \(/);
});

test('reading layout preserves server-rendered titles without client decoration', () => {
  assert.match(layout, /<slot \/>/);
  assert.doesNotMatch(layout, /h1\.innerHTML\s*=|h1\.replaceChildren|accessibleText|signal-decode/);
});

test('note detail exposes an explicit route back to the notes index', () => {
  assert.match(notePage, /href="\/notes"/);
  assert.match(notePage, /BACK_TO_NOTES/);
});
