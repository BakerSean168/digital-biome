import test from 'node:test';
import assert from 'node:assert/strict';
import { OTHER_TABS } from './other-pages';
import { HOME_SLASH_LINKS } from './home-profile';
import { PRIMARY_NAVIGATION, SEARCH_NAVIGATION_INDEX } from './navigation-policy';

test('the home lists every Slash Page and shows section plus local tab shortcuts', () => {
  assert.equal(HOME_SLASH_LINKS.length, 14);
  assert.ok(!HOME_SLASH_LINKS.some((item) => item.href === '/other'));
  assert.deepEqual(
    HOME_SLASH_LINKS.slice(6).map(({ href, label, shortcut }) => ({ href, label, shortcut })),
    OTHER_TABS.map(({ id }, index) => ({
      href: '/other#' + id,
      label: '/' + id,
      shortcut: `g o ${index + 1}`,
    })),
  );
  assert.deepEqual(
    HOME_SLASH_LINKS.slice(4, 6).map(({ label, shortcut }) => ({ label, shortcut })),
    [
      { label: '/blog', shortcut: 'g l 1' },
      { label: '/notes', shortcut: 'g l 2' },
    ],
  );
  assert.equal(new Set(HOME_SLASH_LINKS.map((item) => item.href)).size, 14);
  assert.ok(!HOME_SLASH_LINKS.some(({ href }) => href.includes('bookmarks')));
});

test('g o navigates to Other and the dock shares the same seven top-level destinations', () => {
  assert.equal(PRIMARY_NAVIGATION.length, 7);
  assert.ok(PRIMARY_NAVIGATION.some((item) => item.title === 'Other' && item.href === '/other'));
  assert.ok(SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/other'));
});
