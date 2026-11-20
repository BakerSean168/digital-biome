import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { HEADER_CONTROLS, SEARCH_NAVIGATION_INDEX } from '../src/config/navigation-policy';

const header = fs.readFileSync(path.resolve('src/components/common/Header.astro'), 'utf8');
const adr = fs.readFileSync(
  path.resolve('docs/adr/0004-minimal-header-command-surface.md'),
  'utf8',
);

test('global header policy contains exactly Search and Access', () => {
  assert.deepEqual([...HEADER_CONTROLS], ['search', 'access']);
  assert.equal(new Set(HEADER_CONTROLS).size, 2);
  assert.match(header, /data-header-control="search"/);
  assert.match(header, /data-header-control="access"/);
  assert.doesNotMatch(header, /href="\/systems"/);
  assert.doesNotMatch(header, /\[ SYSTEMS \]/);
});

test('Infrastructure is the only canonical service directory command', () => {
  const entry = SEARCH_NAVIGATION_INDEX.find((item) => item.href === '/infrastructure');
  assert.ok(entry);
  assert.equal(entry.title, 'Infrastructure');
  assert.equal(
    SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/systems'),
    false,
  );
});

test('ADR makes third global controls an explicit architecture decision', () => {
  assert.match(adr, /exactly two semantic controls/i);
  assert.match(adr, /No third destination button is allowed/i);
  assert.match(adr, /requires an explicit ADR update/i);
});
