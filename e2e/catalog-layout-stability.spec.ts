import { expect, test } from '@playwright/test';

const catalogs = ['/projects/', '/notes/', '/blog/', '/uses/'];
const hiddenDescriptions = [
  '从想法到可使用的作品。选择一个项目，查看它的入口与关联。',
  '博客文章 · 完整的叙述、实践与思考。',
  '知识笔记 · 概念、方法与学习的连接。',
];

test('Project and Library pages omit repeated introductory copy', async ({ page }) => {
  for (const path of catalogs.slice(0, 3)) {
    await page.goto(`${path}?ui=gui`);
    await expect(page.locator('body')).toHaveClass(/browser-page/);
    for (const sentence of hiddenDescriptions) {
      await expect(page.locator('#site-content')).not.toContainText(sentence);
    }
  }
});

test('filter controls keep the same geometry before and after browser hydration', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 850 });

  for (const mode of ['gui', 'tui']) {
    for (const path of catalogs) {
      await page.goto(`${path}?ui=${mode}`);
      await expect(page.locator('html')).toHaveAttribute('data-browser-ready', 'true');
      await expect(page.locator('body')).toHaveClass(/browser-page/);
      const positions = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>(
          '[data-object-browser]:not([hidden]) [data-filter-bar]',
        );
        if (!bar) throw new Error('Expected a server-rendered catalog filter bar');
        const position = () => {
          const measure = (selector: string) => {
            const node = bar.querySelector(selector);
            if (!node) throw new Error(`Missing filter control: ${selector}`);
            const box = node.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          };
          return {
            bar: (() => {
              const box = bar.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height };
            })(),
            search: measure('[data-object-filter]'),
            sort: measure('[data-object-sort]'),
            facet: measure('[data-facet-trigger]'),
            count: measure('[data-object-count]'),
          };
        };
        const mounted = position();
        document.documentElement.removeAttribute('data-browser-ready');
        const beforeHydration = position();
        document.documentElement.setAttribute('data-browser-ready', 'true');
        return { mounted, beforeHydration };
      });
      for (const control of Object.keys(positions.mounted) as Array<
        keyof typeof positions.mounted
      >) {
        for (const edge of ['x', 'y', 'width', 'height'] as const) {
          expect(
            Math.abs(positions.mounted[control][edge] - positions.beforeHydration[control][edge]),
            `${path} ${mode} ${control} ${edge} moved during hydration`,
          ).toBeLessThan(1);
        }
      }
    }
  }
});

test('Library tabs and Projects retain usable filters after navigation', async ({ page }) => {
  await page.goto('/projects/?ui=gui');
  await expect(page.locator('[data-object-filter]')).toBeVisible();
  await page.locator('[data-object-filter]').fill('BodySense');
  await expect(page.locator('[data-object-row]:visible')).toHaveCount(1);

  await page.goto('/notes/?ui=gui');
  await page
    .getByRole('navigation', { name: '写作内容类型' })
    .getByRole('link', { name: /blog/ })
    .click();
  await expect(page).toHaveURL(/\/blog\/?\?ui=gui$/);
  await expect(page.locator('[data-object-filter]')).toBeVisible();
  await page.locator('[data-object-filter]').fill('MemoFlow');
  await expect(page.locator('[data-object-row]:visible').first()).toContainText('MemoFlow');
});
