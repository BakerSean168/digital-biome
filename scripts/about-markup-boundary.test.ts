import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAboutMarkupBoundary } from './about-markup-boundary';

const about = '<div data-heatmap-grid role="img"><div class="contribution-cell"></div><div class="contribution-cell"></div></div>';
const tags = '<div data-tag-count="2"><a class="tag-chip">a</a><a class="tag-chip">b</a></div>';

test('accepts one compact node per contribution day and one real SSR link per tag', () => {
  assert.doesNotThrow(() => assertAboutMarkupBoundary(about, tags, { contributionDays: 2 }));
});

test('rejects per-tag Lucide SVG regression', () => {
  assert.throws(
    () => assertAboutMarkupBoundary(about, tags.replace('</div>', '<svg class="lucide-tag"></svg></div>'), { contributionDays: 2 }),
    /one SVG icon per tag/,
  );
});

test('rejects expanded contribution or tag markup counts', () => {
  assert.throws(() => assertAboutMarkupBoundary(about, tags, { contributionDays: 3 }), /compact contribution cells/);
  assert.throws(() => assertAboutMarkupBoundary(about, tags.replace('data-tag-count="2"', 'data-tag-count="3"'), { contributionDays: 2 }), /SSR tag links/);
});
