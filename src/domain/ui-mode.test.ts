import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUiMode, resolveUiMode, urlAfterModeChoice, withUiMode } from './ui-mode';

test('URL mode overrides a valid preference; invalid inputs fall back to TUI', () => {
  assert.equal(resolveUiMode(new URL('https://biome.test/tools?ui=gui'), 'tui'), 'gui');
  assert.equal(resolveUiMode(new URL('https://biome.test/tools?ui=bad'), 'gui'), 'gui');
  assert.equal(resolveUiMode(new URL('https://biome.test/'), null), 'tui');
  for (const value of ['GUI', '', null, {}, 1]) assert.equal(parseUiMode(value), undefined);
});

test('manual switching retains route, query and hash and has a storage-failure fallback', () => {
  const current = new URL('https://biome.test/tools?ui=tui&q=some%20tool#hosts');
  const saved = urlAfterModeChoice(current, 'gui', true);
  assert.equal(saved.searchParams.get('q'), 'some tool');
  assert.equal(saved.hash, '#hosts');
  assert.equal(saved.searchParams.has('ui'), false);
  assert.equal(urlAfterModeChoice(current, 'gui', false).searchParams.get('ui'), 'gui');
  assert.equal(current.searchParams.get('ui'), 'tui');
});

test('temporary mode follows content navigation without changing external or auth endpoints', () => {
  const current = new URL('https://biome.test/tools?ui=gui');
  assert.equal(
    withUiMode('/notes?tag=tech%2Fweb#reading', current),
    '/notes?tag=tech%2Fweb&ui=gui#reading',
  );
  for (const href of [
    'https://figma.com/',
    '//other.test/',
    'mailto:a@example.test',
    '/api/private/session',
    '/cdn-cgi/access/logout',
  ]) {
    assert.equal(withUiMode(href, current), href);
  }
  assert.equal(withUiMode('/notes', new URL('https://biome.test/?ui=invalid')), '/notes');
});
