import { expect, test } from '@playwright/test';

test('About stands alone: enduring interests, no cross-page or social links', async ({ page }) => {
  await page.goto('/about/?ui=gui');
  const about = page.locator('article[data-ui-only="gui"]');

  await expect(about.getByRole('heading', { name: /你好，我是 BakerSean/ })).toBeVisible();
  await expect(about.locator('[data-about-section]')).toHaveCount(4);
  await expect(about).toContainText('家庭网络');
  await expect(about).toContainText('叔本华');
  await expect(about).toContainText('Thought Forest');
  await expect(about.locator('[data-reading-anchor="about-content"]')).toContainText('Notes');
  await expect(about.locator('a')).toHaveCount(0);
  await expect(about).not.toContainText('绝命毒师');
  await expect(about).not.toContainText('期望薪资');
});

test('About stays self-contained in terminal mode while global navigation works', async ({
  page,
}) => {
  await page.goto('/about/?ui=tui');
  const about = page.locator('article[data-ui-only="tui"]');

  await expect(about.getByRole('heading', { name: 'BakerSean' })).toBeVisible();
  await expect(about).toContainText('家庭网络');
  await expect(about).toContainText('矮人要塞');
  await expect(about).toContainText('叔本华');
  await expect(about.locator('a')).toHaveCount(0);

  await page.locator('[data-terminal-dock] a[href^="/now"]').click();
  await expect(page).toHaveURL(/\/now\/?\?ui=tui$/);
  await expect(page.locator('article[data-ui-only="tui"]')).toContainText('绝命毒师');
});
