import { expect, test } from '@playwright/test';

const readingPages = ['/about/', '/now/'];
const scrollPosition = async (page: import('@playwright/test').Page) =>
  page.locator('#site-content').evaluate((node) => node.scrollTop);

test('j/k scrolls the active About or Now reading page in GUI and TUI', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  for (const mode of ['gui', 'tui']) {
    for (const path of readingPages) {
      await page.goto(`${path}?ui=${mode}`);
      const content = page.locator('#site-content');
      await expect(page.locator('[data-reading-scroll]:visible')).toHaveCount(1);
      const dimensions = await content.evaluate((node) => ({
        viewport: node.clientHeight,
        content: node.scrollHeight,
      }));
      expect(dimensions.content, `${path} should overflow at phone size`).toBeGreaterThan(
        dimensions.viewport + 180,
      );
      expect(await scrollPosition(page)).toBe(0);

      await page.keyboard.press('j');
      await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
      const first = await scrollPosition(page);
      await page.keyboard.press('j');
      await expect.poll(() => scrollPosition(page)).toBeGreaterThan(first);
      const second = await scrollPosition(page);

      await page.keyboard.press('k');
      await expect.poll(() => scrollPosition(page)).toBeLessThan(second);
      await page.keyboard.press('k');
      await expect.poll(() => scrollPosition(page)).toBe(0);
    }
  }
});

test('reading shortcuts ignore text inputs, modifier chords, and open dialogs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto('/about/?ui=tui');

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'reading-typing-test';
    input.style.cssText = 'position: fixed; top: 4px; right: 4px; z-index: 90;';
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.press('j');
  await expect(page.locator('#reading-typing-test')).toHaveValue('j');
  expect(await scrollPosition(page)).toBe(0);
  await page.locator('#reading-typing-test').evaluate((node) => node.remove());

  await page.keyboard.press('Control+j');
  expect(await scrollPosition(page)).toBe(0);

  await page.locator('[data-terminal-help]:visible').click();
  await expect(page.locator('#terminal-help')).toBeVisible();
  await page.keyboard.press('j');
  expect(await scrollPosition(page)).toBe(0);

  await page.locator('[data-shortcuts-enabled]').uncheck();
  await page.locator('#terminal-help button[aria-label="关闭帮助"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'off');
  await page.keyboard.press('j');
  expect(await scrollPosition(page)).toBe(0);

  await page.locator('[data-terminal-help]:visible').click();
  await page.locator('[data-shortcuts-enabled]').check();
  await page.locator('#terminal-help button[aria-label="关闭帮助"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  await page.keyboard.press('j');
  await expect.poll(() => scrollPosition(page)).toBeGreaterThan(0);
});

test('j/k still selects catalog objects rather than scrolling the reading page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto('/projects/?ui=tui');
  const selected = page.locator('[data-object-row][aria-current="true"]:visible');
  await expect(selected).toContainText('BodySense');
  await page.keyboard.press('j');
  await expect(selected).toContainText('ForgeFlow');
  await page.keyboard.press('k');
  await expect(selected).toContainText('BodySense');
});
