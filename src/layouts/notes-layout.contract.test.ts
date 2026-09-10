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

test('note title decoration preserves text as text rather than parsing HTML', () => {
  assert.doesNotMatch(layout, /h1\.innerHTML\s*=/);
  assert.match(layout, /accessibleText\.textContent = text/);
  assert.match(layout, /visualText\.textContent = text/);
  assert.match(layout, /h1\.replaceChildren\(accessibleText, visualText\)/);
});

test('note detail exposes an explicit route back to the notes index', () => {
  assert.match(notePage, /href="\/notes"/);
  assert.match(notePage, /BACK_TO_NOTES/);
});
