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

test('Uses, Projects and Library tabs share consistent height across modes and screen sizes', async ({
  page,
}) => {
  const pages = ['/projects/', '/notes/', '/blog/', '/uses/'];
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 850 });
    for (const mode of ['gui', 'tui']) {
      const heights: number[] = [];
      for (const path of pages) {
        await page.goto(`${path}?ui=${mode}`);
        const measured = await page.locator('.content-tabs').evaluate((nav) => {
          const tabs = Array.from(nav.querySelectorAll('a'));
          const values = tabs.map((tab) => tab.getBoundingClientRect().height);
          return {
            heights: values,
            navHeight: nav.getBoundingClientRect().height,
            horizontalOverflow: nav.scrollWidth > nav.clientWidth + 1,
            pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        expect(measured.heights.length).toBeGreaterThan(0);
        expect(Math.max(...measured.heights) - Math.min(...measured.heights)).toBeLessThan(1);
        expect(measured.pageOverflow, `${path} ${mode} overflows at ${width}px`).toBe(false);
        heights.push(measured.heights[0]);
        if (path === '/uses/' && width === 390) {
          expect(measured.horizontalOverflow).toBe(true);
          await page.locator('[data-uses-tab="network"]').click();
          await expect(page.locator('[data-uses-tab="network"]')).toHaveAttribute(
            'aria-current',
            'true',
          );
        }
      }
      expect(
        Math.max(...heights) - Math.min(...heights),
        `Catalog tabs differ in ${mode} at ${width}px: ${heights.join(', ')}`,
      ).toBeLessThan(1);
    }
  }
});

test('catalog status feedback never shifts rows and desktop filters stay together', async ({
  page,
}) => {
  for (const mode of ['gui', 'tui']) {
    for (const path of catalogs) {
      await page.setViewportSize({ width: 1366, height: 850 });
      await page.goto(`${path}?ui=${mode}`);
      await expect(page.locator('html')).toHaveAttribute('data-browser-ready', 'true');
      const layout = await page.locator('[data-object-browser]:visible').evaluate((root) => {
        const status = root.querySelector<HTMLElement>('[data-object-status]');
        const bar = root.querySelector<HTMLElement>('[data-filter-bar]');
        const columns = root.querySelector<HTMLElement>('[data-browser-columns]');
        const search = bar?.querySelector<HTMLElement>('label:first-child');
        const sort = bar?.querySelector<HTMLElement>('label:has([data-object-sort])');
        const facet = bar?.querySelector<HTMLElement>('[data-facet-trigger]');
        const count = bar?.querySelector<HTMLElement>('[data-object-count]');
        if (!status || !bar || !columns || !search || !sort || !facet || !count)
          throw new Error('Catalog toolbar or feedback region is missing');
        const bounds = (element: HTMLElement) => {
          const { x, y, width, height, right } = element.getBoundingClientRect();
          return { x, y, width, height, right };
        };
        const before = bounds(columns);
        const statusStyle = getComputedStyle(status);
        status.textContent = '已显示全部';
        const after = bounds(columns);
        const positions = [search, sort, facet, count].map(bounds);
        status.textContent = '';
        return {
          before,
          after,
          statusPosition: statusStyle.position,
          statusWidth: statusStyle.width,
          positions,
        };
      });
      expect(layout.statusPosition).toBe('absolute');
      expect(layout.before.y).toBeCloseTo(layout.after.y, 1);
      expect(layout.before.height).toBeCloseTo(layout.after.height, 1);
      for (let index = 0; index < layout.positions.length - 1; index++) {
        const current = layout.positions[index];
        const next = layout.positions[index + 1];
        expect(
          Math.abs(next.y + next.height / 2 - (current.y + current.height / 2)),
          `${path} ${mode} toolbar control wrapped`,
        ).toBeLessThan(3);
        expect(
          next.x - current.right,
          `${path} ${mode} toolbar controls must be grouped, not spaced apart`,
        ).toBeLessThan(28);
      }
      expect(
        await page.locator('[data-object-browser]:visible [data-object-status]').textContent(),
      ).not.toContain('已显示全部');
    }
  }
});
