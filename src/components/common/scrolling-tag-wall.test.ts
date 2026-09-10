import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const component = readFileSync(fileURLToPath(new URL('./ScrollingTagWall.astro', import.meta.url)), 'utf8');

test('keeps duplicate tags hidden and non-focusable while pausing for keyboard focus', () => {
  assert.match(component, /aria-hidden="true"/);
  assert.match(component, /tabindex="-1"/);
  assert.match(component, /\.marquee-lane:focus-within/);
  assert.match(component, /\.tag-node:focus-visible/);
  assert.match(component, /prefers-reduced-motion: reduce/);
});
