import { expect, test } from '@playwright/test';

test('Infrastructure registry retains four resource groups, status codes and private-link fallbacks', async ({
  page,
}) => {
  await page.route('**/api/private/**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/infrastructure/?ui=gui');
  const registry = page.locator('#inventory');
  await expect(registry.locator('details')).toHaveCount(4);
  for (const label of ['Hosts', 'Services', 'Network', 'Platforms']) {
    await expect(registry.locator('summary').filter({ hasText: label })).toHaveCount(1);
  }
  for (const icon of await registry.locator('summary svg').all()) {
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
  }
  const statuses = (await registry.locator('tbody tr td:nth-child(2)').allTextContents())
    .map((value) => value.trim())
    .filter(Boolean);
  expect(statuses.length).toBeGreaterThan(10);
  for (const status of statuses) {
    expect(['ACTIVE', 'PLANNED', 'RETIRED', 'ARCHIVED', 'DECOMMISSIONING']).toContain(status);
  }
  const protectedEntry = registry.locator('[data-private-link]').first();
  await expect(protectedEntry).toHaveAttribute('href', /\/login\?next=/);
  await expect(protectedEntry).toHaveAttribute('data-private-link', /.+/);
});

test('Infrastructure detail retains icon, status and locked private values at mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/private/**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/infrastructure/host-n100-pve/?ui=gui');
  await expect(page.locator('h1')).not.toBeEmpty();
  await expect(page.locator('main header')).toContainText('登记状态：');
  await expect(page.locator('main header svg').first()).toBeVisible();
  await expect(page.locator('main')).toContainText('Entrypoints');
  for (const locked of await page.locator('[data-private-value]').all()) {
    await expect(locked).toHaveText('LOCKED');
  }
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    content: document.querySelector('#site-content')?.scrollWidth ?? Infinity,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.width);
});
