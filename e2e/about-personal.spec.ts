import { expect, test } from '@playwright/test';
import { ABOUT_SECTIONS, ABOUT_UPDATED_AT } from '../src/config/about-profile';

test('About is a personal essay with one banner, last updated and six sections', async ({
  page,
}) => {
  await page.goto('/about/?ui=gui');
  const about = page.locator('article[data-ui-only="gui"]');

  await expect(about.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await expect(about.locator('header time')).toHaveAttribute('datetime', ABOUT_UPDATED_AT);
  await expect(about.locator('[data-about-section]')).toHaveCount(6);

  for (const section of ABOUT_SECTIONS) {
    const block = about.locator(`[data-about-section="${section.id}"]`);
    await expect(block.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
    await expect(block.locator('p')).toHaveText([...section.paragraphs]);
  }

  await expect(about).toContainText('饥荒联机');
  await expect(about).toContainText('N100');
  await expect(about).toContainText('传感器');
  await expect(about).toContainText('大乱斗玩家');
  await expect(about).toContainText('虚无主义者');
  await expect(about).toContainText('简洁 != 简单');
  await expect(about).toContainText('坐骨神经痛');
  await expect(about).toContainText('右肩');
  await expect(about.locator('a')).toHaveCount(0);
  await expect(about.locator('article, aside, dl, footer')).toHaveCount(0);
  await expect(about).not.toContainText('喜欢折腾，也喜欢观察');
  await expect(about).not.toContainText('Digital Biome 里有什么');
});

test('About retains the same full text in terminal mode and global navigation works', async ({
  page,
}) => {
  await page.goto('/about/?ui=tui');
  const about = page.locator('article[data-ui-only="tui"]');

  await expect(about.locator('header time')).toHaveAttribute('datetime', ABOUT_UPDATED_AT);
  await expect(about.locator('[data-about-section]')).toHaveCount(ABOUT_SECTIONS.length);
  for (const section of ABOUT_SECTIONS) {
    const block = about.locator(`[data-about-section="${section.id}"]`);
    await expect(block.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
    await expect(block.locator('p')).toHaveText([...section.paragraphs]);
  }
  await expect(about.locator('a')).toHaveCount(0);

  await page.locator('[data-terminal-dock] a[href^="/now"]').click();
  await expect(page).toHaveURL(/\/now\/?\?ui=tui$/);
  await expect(page.locator('article[data-ui-only="tui"]')).toContainText('绝命毒师');
});
