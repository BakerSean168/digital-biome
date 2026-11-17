import { expect, test } from '@playwright/test';

test('About presents personal interests without turning into a resume', async ({ page }) => {
  await page.goto('/about/?ui=gui');

  await expect(page.getByRole('heading', { name: /你好，我是 BakerSean/ })).toBeVisible();
  await expect(page.locator('[data-ui-only="gui"] [data-about-section]')).toHaveCount(5);
  await expect(page.locator('[data-ui-only="gui"] [data-about-section="games"] li')).toHaveCount(4);
  await expect(
    page.locator('[data-ui-only="gui"] [data-about-section="media"] article'),
  ).toHaveCount(2);
  await expect(page.locator('article[data-ui-only="gui"] a[href^="/dev"]')).toHaveAttribute(
    'href',
    /\/dev/,
  );
  await expect(page.locator('article[data-ui-only="gui"]')).not.toContainText('期望薪资');
});

test('About keeps the same interests accessible in terminal mode', async ({ page }) => {
  await page.goto('/about/?ui=tui');
  const terminal = page.locator('article[data-ui-only="tui"]');

  await expect(terminal.getByRole('heading', { name: 'BakerSean' })).toBeVisible();
  await expect(terminal).toContainText('家庭网络');
  await expect(terminal).toContainText('矮人要塞');
  await expect(terminal).toContainText('绝命毒师');
  await expect(terminal).toContainText('叔本华');
});
