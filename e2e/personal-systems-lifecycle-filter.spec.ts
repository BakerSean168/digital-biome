import { expect, test } from '@playwright/test';

test('Personal Systems services default to active and switch lifecycle states', async ({
  page,
}) => {
  await page.goto('/systems/?ui=gui');

  const root = page.locator('[data-service-filter-root]');
  const active = root.locator('[data-service-filter="active"]');
  const planned = root.locator('[data-service-filter="planned"]');
  const retired = root.locator('[data-service-filter="retired"]');
  const all = root.locator('[data-service-filter="all"]');

  const activeRows = root.locator('[data-service-row][data-service-lifecycle-group="active"]');
  const plannedRows = root.locator('[data-service-row][data-service-lifecycle-group="planned"]');
  const retiredRows = root.locator('[data-service-row][data-service-lifecycle-group="retired"]');
  const allRows = root.locator('[data-service-row]');

  const activeCount = await activeRows.count();
  const plannedCount = await plannedRows.count();
  const retiredCount = await retiredRows.count();
  expect(activeCount).toBeGreaterThan(0);
  expect(plannedCount).toBeGreaterThan(0);
  expect(retiredCount).toBeGreaterThan(0);

  await expect(active).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('[data-service-row]:visible')).toHaveCount(activeCount);
  await expect(root.locator('[data-service-visible-count]')).toContainText(
    `显示 ${activeCount} 项`,
  );

  await planned.click();
  await expect(planned).toHaveAttribute('aria-pressed', 'true');
  await expect(active).toHaveAttribute('aria-pressed', 'false');
  await expect(root.locator('[data-service-row]:visible')).toHaveCount(plannedCount);
  await expect(root.locator('[data-service-category-count]:visible').first()).not.toBeEmpty();
  await expect(page).toHaveURL(/serviceStatus=planned/);

  await retired.click();
  await expect(retired).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('[data-service-row]:visible')).toHaveCount(retiredCount);
  await expect(root.locator('#service-svc-sing-box-japan')).toBeVisible();
  await expect(root.locator('#service-svc-sing-box-japan a')).toHaveCount(2);
  await expect(page).toHaveURL(/serviceStatus=retired/);

  await all.click();
  await expect(root.locator('[data-service-row]:visible')).toHaveCount(await allRows.count());
  await expect(root.locator('[data-service-visible-count]')).toContainText(
    `显示 ${await allRows.count()} 项`,
  );

  await active.click();
  await expect(root.locator('[data-service-row]:visible')).toHaveCount(activeCount);
  await expect(page).not.toHaveURL(/serviceStatus=/);
  await expect(root.locator('[data-service-empty]')).toBeHidden();
  await expect(root.locator('#service-svc-nezha-panel')).toHaveCount(0);
});

test('Personal Systems filter is linkable and never presents historical launch actions', async ({
  page,
}) => {
  await page.goto('/systems/?ui=gui&serviceStatus=retired');
  const root = page.locator('[data-service-filter-root]');

  await expect(root.locator('[data-service-filter="retired"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(root.locator('#service-svc-sing-box-japan')).toBeVisible();
  const historicalRow = root.locator('#service-svc-sing-box-japan');
  await expect(historicalRow.locator('a[href^="/infrastructure/"]')).toHaveCount(2);
  await expect(historicalRow.locator('a[target="_blank"]')).toHaveCount(0);
  await expect(historicalRow.locator('[data-private-link]')).toHaveCount(0);
  await expect(root.locator('[data-service-category-section]:visible')).not.toHaveCount(0);

  await page.goto('/systems/?ui=gui#service-svc-sing-box-japan');
  await expect(root.locator('#service-svc-sing-box-japan')).toBeVisible();
  await expect(root.locator('[data-service-filter="retired"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
