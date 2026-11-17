import { expect, test } from '@playwright/test';

test('About describes long-lived interests and links to Now without becoming a resume', async ({
  page,
}) => {
  await page.goto('/about/?ui=gui');
  const about = page.locator('article[data-ui-only="gui"]');

  await expect(about.getByRole('heading', { name: /你好，我是 BakerSean/ })).toBeVisible();
  await expect(about.locator('[data-about-section]')).toHaveCount(4);
  await expect(about).toContainText('家庭网络');
  await expect(about).toContainText('叔本华');
  await expect(about.locator('a[href^="/now"]').first()).toBeVisible();
  await expect(about.locator('a[href^="/projects"]').first()).toHaveAttribute('href', /\/projects/);
  await expect(about).not.toContainText('期望薪资');
  await expect(about).not.toContainText('绝命毒师');
});

test('About and Now remain connected in terminal mode', async ({ page }) => {
  await page.goto('/about/?ui=tui');
  const terminal = page.locator('article[data-ui-only="tui"]');

  await expect(terminal.getByRole('heading', { name: 'BakerSean' })).toBeVisible();
  await expect(terminal).toContainText('家庭网络');
  await expect(terminal).toContainText('矮人要塞');
  await expect(terminal).toContainText('叔本华');
  await expect(terminal).not.toContainText('绝命毒师');

  await terminal.locator('a[href^="/now"]').first().click();
  await expect(page).toHaveURL(/\/now\/?\?ui=tui$/);
  await expect(page.locator('article[data-ui-only="tui"]')).toContainText('绝命毒师');
});
