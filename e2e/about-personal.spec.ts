import { expect, test } from '@playwright/test';
import { aboutSource, nowSource } from './site-page-expected';

const publishedRelatedLinks = aboutSource.links;

test('About renders source-authored sections and verified links', async ({ page }) => {
  await page.goto('/about/?ui=gui');
  const about = page.locator('article[data-ui-only="gui"]');

  await expect(about.getByRole('heading', { name: aboutSource.title, exact: true })).toBeVisible();
  await expect(about.locator('header')).toContainText('/ ABOUT');
  await expect(about.locator('h1')).toHaveText(aboutSource.title);
  await expect(about.locator('header time')).toHaveAttribute('datetime', aboutSource.updatedAt);
  await expect(about.locator('[data-about-section]')).toHaveCount(6);

  for (const section of aboutSource.sections) {
    const block = about.locator(`[data-about-section="${section.id}"]`);
    await expect(block.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
    await expect(block.locator('p')).toHaveText(section.paragraphs.map(aboutSource.visibleText));
  }

  await expect(about.locator('a')).toHaveCount(publishedRelatedLinks.length);
  for (const relation of publishedRelatedLinks) {
    const link = about.getByRole('link', { name: relation.phrase, exact: true });
    await expect(link).toHaveAttribute('href', /^\//);
    if (relation.anchor) {
      expect(await link.getAttribute('href')).toContain(relation.anchor);
    }
  }
  await expect(about.locator('article, aside, dl, footer')).toHaveCount(0);
});

test('About retains the same full text in terminal mode and global navigation works', async ({
  page,
}) => {
  await page.goto('/about/?ui=tui');
  const about = page.locator('article[data-ui-only="tui"]');

  await expect(about.locator('header time')).toHaveAttribute('datetime', aboutSource.updatedAt);
  await expect(about.locator('[data-about-section]')).toHaveCount(aboutSource.sections.length);
  for (const section of aboutSource.sections) {
    const block = about.locator(`[data-about-section="${section.id}"]`);
    await expect(block.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
    await expect(block.locator('p')).toHaveText(section.paragraphs.map(aboutSource.visibleText));
  }
  await expect(about.locator('a')).toHaveCount(publishedRelatedLinks.length);

  await page.locator('[data-terminal-dock] a[href^="/now"]').click();
  await expect(page).toHaveURL(/\/now\/?\?ui=tui$/);
  await expect(page.locator('article[data-ui-only="tui"]')).toContainText(
    nowSource.entries[0].title,
  );
});
