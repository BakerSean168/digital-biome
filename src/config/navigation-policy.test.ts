import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMARY_NAVIGATION,
  SEARCH_NAVIGATION_INDEX,
  activeNavigation,
  pageMode,
} from './navigation-policy';

test('dock and first search destinations share the same names, routes and order', () => {
  assert.deepEqual(
    SEARCH_NAVIGATION_INDEX.slice(0, 5).map(({ title, href }) => ({ title, href })),
    PRIMARY_NAVIGATION.map(({ title, href }) => ({ title, href })),
  );
  assert.deepEqual(
    PRIMARY_NAVIGATION.map((item) => item.title),
    ['Home', 'Library', 'Projects', 'Tools', 'About'],
  );
});
test('detail routes and Library subtypes resolve to their primary destination', () => {
  for (const path of ['/notes/', '/notes/obsidian/example', '/blog/', '/about/tags'])
    assert.equal(activeNavigation(path), '/notes');
  for (const path of ['/dev/example', '/projects/example'])
    assert.equal(activeNavigation(path), '/dev');
  for (const path of ['/systems/', '/infrastructure/host-example', '/tools/'])
    assert.equal(activeNavigation(path), '/tools');
  assert.equal(activeNavigation('/aboutness'), undefined);
  assert.equal(activeNavigation('/toolshed'), undefined);
  assert.equal(pageMode('/friends/'), 'FRIENDS');
  assert.equal(pageMode('/login'), 'ACCESS');
});
test('Blog and Friends remain directly discoverable without inventing Library routes', () => {
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/blog'));
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/friends'));
  assert.ok(!SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/library'));
});
