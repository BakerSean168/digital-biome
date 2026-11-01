import { expect, test } from '@playwright/test';

const privateDomain = {
  version: 1,
  access: 'owner',
  facts: { domainCount: 1, repositoryCount: 1, projectionCount: 0 },
  domains: [
    {
      id: 'private-demo-domain',
      name: 'Private E2E Domain',
      repositories: [
        {
          id: 'private-e2e-repository',
          relation: 'canonical',
          webUrl: 'https://github.com/demo/test-repo',
        },
      ],
    },
  ],
};

test('anonymous public /systems shell never requests owner catalog or reveals owner domains', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/systems/')).text();
  expect(html).toContain('System Registry');
  expect(html).toContain('Owner-only systems');
  expect(html).not.toContain('Private E2E Domain');
  expect(html).not.toContain('private-e2e-repository');

  let ownerRequests = 0;
  let sessionRequests = 0;
  await page.route('**/api/private/session', (route) => {
    sessionRequests++;
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/private/systems', (route) => {
    ownerRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(privateDomain),
    });
  });

  await page.goto('/systems/?ui=gui');
  await expect(page.locator('[data-systems-access-label]')).toHaveText('Public view');
  await expect(page.locator('[data-owner-domain-gate]')).toBeVisible();
  await expect(page.locator('[data-owner-system-domain]')).toHaveCount(0);
  await expect.poll(() => sessionRequests).toBe(1);
  await expect(page.locator('[data-systems-access-action]')).toHaveAttribute(
    'href',
    /\/login\?next=/,
  );
  expect(ownerRequests).toBe(0);
});

test('verified session and valid owner-only catalog hydrate just the private registry at runtime', async ({
  page,
}) => {
  let sessionRequests = 0;
  let catalogRequests = 0;
  await page.route('**/api/private/session', (route) => {
    sessionRequests++;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true }),
    });
  });
  await page.route('**/api/private/systems', (route) => {
    catalogRequests++;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(privateDomain),
    });
  });

  await page.goto('/systems/?ui=tui');
  await expect(page.locator('[data-systems-access-label]')).toHaveText('Owner view');
  await expect(page.locator('[data-systems-access-action]')).toHaveText('Sign out');
  await expect(page.locator('[data-owner-domain-gate]')).toHaveCount(0);
  const domain = page.locator('[data-owner-system-domain="private-demo-domain"]');
  await expect(domain).toContainText('Private E2E Domain');
  await domain.locator('summary').click();
  await expect(domain).toContainText('private-e2e-repository');
  await expect(domain.locator('a')).toHaveAttribute('href', 'https://github.com/demo/test-repo');
  await expect(domain.locator('a')).toHaveAttribute('target', '_blank');
  await expect(domain.locator('a')).toHaveAttribute('rel', 'noopener noreferrer');
  expect(sessionRequests).toBe(1);
  expect(catalogRequests).toBe(1);
  // Private owner metadata never enters URL or browser History snapshots.
  expect(page.url()).not.toContain('private-e2e-repository');
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(
    'private-e2e-repository',
  );
});

test('authenticated but denied, failed or invalid catalog response retains public registry only', async ({
  page,
}) => {
  await page.route('**/api/private/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true }),
    }),
  );
  let mode: 'forbidden' | 'error' | 'invalid' = 'forbidden';
  await page.route('**/api/private/systems', (route) => {
    if (mode === 'forbidden') return route.fulfill({ status: 403, body: '{}' });
    if (mode === 'error') return route.fulfill({ status: 503, body: '{}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...privateDomain,
        domains: [
          privateDomain.domains[0],
          {
            id: 'bad-domain',
            name: 'Should Never Partially Render',
            repositories: [
              { id: 'malicious', relation: 'canonical', webUrl: 'javascript:alert(1)' },
            ],
          },
        ],
      }),
    });
  });

  for (const variant of ['forbidden', 'error', 'invalid'] as const) {
    mode = variant;
    await page.goto('/systems/?ui=gui');
    await expect(page.locator('[data-systems-access-label]')).toHaveText('Owner view');
    await expect(page.locator('[data-owner-domain-gate]')).toBeVisible();
    await expect(page.locator('[data-owner-system-domain]')).toHaveCount(0);
    expect(await page.content()).not.toContain('Should Never Partially Render');
  }
});
