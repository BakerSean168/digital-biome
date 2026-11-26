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
    SEARCH_NAVIGATION_INDEX.slice(0, 7).map(({ title, href }) => ({ title, href })),
    PRIMARY_NAVIGATION.map(({ title, href }) => ({ title, href })),
  );
  assert.deepEqual(
    PRIMARY_NAVIGATION.map((item) => item.title),
    ['Home', 'Library', 'Projects', 'Uses', 'About', 'Now', 'Other'],
  );
});
test('detail routes and Library subtypes resolve to their primary destination', () => {
  for (const path of ['/notes/', '/notes/obsidian/example', '/blog/', '/about/tags'])
    assert.equal(activeNavigation(path), '/notes');
  for (const path of ['/projects/example']) assert.equal(activeNavigation(path), '/projects');
  for (const path of ['/infrastructure/host-example', '/uses/'])
    assert.equal(activeNavigation(path), '/uses');
  assert.equal(activeNavigation('/uses'), '/uses');
  assert.equal(activeNavigation('/uses/'), '/uses');
  assert.equal(pageMode('/uses'), 'USES');
  assert.equal(activeNavigation('/dashboard'), undefined);
  assert.ok(!SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/dashboard'));
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/uses#dashboard'));
  assert.equal(activeNavigation('/projects'), '/projects');
  assert.equal(pageMode('/projects'), 'PROJECTS');
  assert.equal(activeNavigation('/tools'), undefined);
  assert.equal(activeNavigation('/now'), '/now');
  assert.equal(activeNavigation('/now/'), '/now');
  assert.equal(pageMode('/now'), 'NOW');
  assert.equal(activeNavigation('/other'), '/other');
  assert.equal(activeNavigation('/ai'), '/other');
  assert.equal(pageMode('/other'), 'OTHER');
  assert.equal(activeNavigation('/aboutness'), undefined);
  assert.equal(activeNavigation('/useshed'), undefined);
  assert.equal(pageMode('/friends/'), 'FRIENDS');
  assert.equal(pageMode('/login'), 'ACCESS');
});
test('Blog and Friends remain directly discoverable without inventing Library routes', () => {
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/now'));
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/uses'));
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/blog'));
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/friends'));
  assert.ok(!SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/library'));
});
