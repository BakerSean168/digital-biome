import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogSelectionInView } from './page-scroll';

const rows = Array.from({ length: 12 }, (_, i) => ({
  getBoundingClientRect: () => ({ top: i * 30, bottom: (i + 1) * 30 }) as DOMRect,
}));
const bounds = { top: 120, bottom: 240 };

test('a visible catalog selection keeps normal relative keyboard navigation', () => {
  assert.equal(catalogSelectionInView(rows, 5, 1, bounds), undefined);
  assert.equal(catalogSelectionInView(rows, 5, -1, bounds), undefined);
});

test('an offscreen selection resumes from the visible edge after wheel scrolling', () => {
  assert.equal(catalogSelectionInView(rows, 0, 1, bounds), 4);
  assert.equal(catalogSelectionInView(rows, 0, -1, bounds), 7);
  assert.equal(catalogSelectionInView(rows, 10, 1, bounds), 4);
  assert.equal(catalogSelectionInView(rows, 10, -1, bounds), 7);
});

test('empty catalogs and fully clipped scrollports preserve normal selection behavior', () => {
  assert.equal(catalogSelectionInView([], 0, 1, bounds), undefined);
  assert.equal(catalogSelectionInView(rows, 0, 1, { top: 120, bottom: 120 }), undefined);
  assert.equal(catalogSelectionInView(rows, 0, 1, { top: 400, bottom: 500 }), undefined);
});
