import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOwnerSystems, parseOwnerSystemsPayload } from './owner-systems-data';

const ownerCatalog = {
  version: 1,
  access: 'owner',
  domains: [
    {
      id: 'private-platform',
      name: 'Owner Platform',
      repositories: [
        { id: 'owner/core', relation: 'canonical', webUrl: 'https://github.com/example/core' },
        { id: 'owner/old', relation: 'archived' },
      ],
    },
  ],
  facts: { domainCount: 1, repositoryCount: 2, projectionCount: 0 },
};

test('strict owner payload validation preserves only allowed fields', () => {
  const payload = parseOwnerSystemsPayload({
    ...ownerCatalog,
    secret: 'private-token-must-not-survive',
    domains: [
      {
        ...ownerCatalog.domains[0],
        secret: 'private-token-must-not-survive',
        repositories: [
          { ...ownerCatalog.domains[0].repositories[0], secret: 'private-token-must-not-survive' },
        ],
      },
    ],
  });
  assert.ok(payload);
  assert.equal(payload.domains[0].name, 'Owner Platform');
  assert.equal(payload.domains[0].repositories[0].webUrl, 'https://github.com/example/core');
  assert.doesNotMatch(JSON.stringify(payload), /private-token-must-not-survive/);
});

test('strict owner parser rejects invalid version, access, domain and link shapes without partial output', () => {
  for (const bad of [
    null,
    { ...ownerCatalog, version: 2 },
    { ...ownerCatalog, access: 'public' },
    { ...ownerCatalog, domains: [{ ...ownerCatalog.domains[0], id: 'knowledge' }] },

    { ...ownerCatalog, domains: {} },
    { ...ownerCatalog, domains: [{ ...ownerCatalog.domains[0], name: 123 }] },
    { ...ownerCatalog, domains: [{ ...ownerCatalog.domains[0], repositories: [{}] }] },
    {
      ...ownerCatalog,
      domains: [{ ...ownerCatalog.domains[0], repositories: [{ id: 'a', relation: 'unknown' }] }],
    },
    {
      ...ownerCatalog,
      domains: [
        {
          ...ownerCatalog.domains[0],
          repositories: [{ id: 'a', relation: 'canonical', webUrl: 'javascript:alert(1)' }],
        },
      ],
    },
    {
      ...ownerCatalog,
      domains: [
        {
          ...ownerCatalog.domains[0],
          repositories: [
            { id: 'a', relation: 'canonical', webUrl: 'https://github.com.evil.test/owner/repo' },
          ],
        },
      ],
    },
    {
      ...ownerCatalog,
      domains: [
        {
          ...ownerCatalog.domains[0],
          repositories: [
            {
              id: 'a',
              relation: 'canonical',
              webUrl: 'https://github.com/owner/repo?token=secret',
            },
          ],
        },
      ],
    },
  ])
    assert.equal(parseOwnerSystemsPayload(bad), null);
});

type FetchRecord = { url: string; init: RequestInit };
function createFetcher(
  session: Response | Error,
  systems: Response | Error,
): { fetcher: typeof fetch; records: FetchRecord[] } {
  const records: FetchRecord[] = [];
  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    records.push({ url, init });
    const value = url.endsWith('session') ? session : systems;
    if (value instanceof Error) throw value;
    return value.clone();
  };
  return { fetcher: fetcher as typeof fetch, records };
}

test('anonymous, denied, server-error, bad-session and redirect response never query or expose owner systems', async () => {
  for (const response of [
    new Response('', { status: 401 }),
    new Response('', { status: 403 }),
    new Response('', { status: 502 }),
    Response.json({ authenticated: false }),
    Response.json({ authenticated: 'true' }),
    Response.json({ authenticated: true }, { status: 302 }),
  ]) {
    const { fetcher, records } = createFetcher(response, Response.json(ownerCatalog));
    const result = await loadOwnerSystems(fetcher);
    assert.deepEqual(result, { authenticated: false, catalog: null });
    assert.deepEqual(
      records.map((record) => record.url),
      ['/api/private/session'],
    );
    assert.equal(records[0].init.redirect, 'manual');
    assert.equal(records[0].init.credentials, 'same-origin');
    assert.equal(records[0].init.cache, 'no-store');
  }
});

test('session success queries private catalog once, but 401/403/5xx/invalid JSON never render private data', async () => {
  for (const response of [
    new Response('', { status: 401 }),
    new Response('', { status: 403 }),
    new Response('', { status: 503 }),
    new Response('{broken-json', { headers: { 'content-type': 'application/json' } }),
    Response.json({
      ...ownerCatalog,
      domains: [{ id: 'bad', name: 'unsafe', repositories: [{ webUrl: 'javascript:evil()' }] }],
    }),
  ]) {
    const { fetcher, records } = createFetcher(Response.json({ authenticated: true }), response);
    const result = await loadOwnerSystems(fetcher);
    assert.deepEqual(result, { authenticated: true, catalog: null });
    assert.deepEqual(
      records.map((record) => record.url),
      ['/api/private/session', '/api/private/systems'],
    );
    assert.equal(records[1].init.redirect, 'manual');
    assert.equal(records[1].init.cache, 'no-store');
  }
});

test('authorized and valid owner response unlocks only verified repository view data', async () => {
  const { fetcher, records } = createFetcher(
    Response.json({ authenticated: true }),
    Response.json(ownerCatalog),
  );
  const result = await loadOwnerSystems(fetcher);
  assert.equal(result.authenticated, true);
  assert.equal(result.catalog?.domains.length, 1);
  assert.equal(result.catalog?.domains[0].repositories.length, 2);
  assert.ok(records.every(({ init }) => init.credentials === 'same-origin'));
});

test('network failures and aborted requests fail closed with no retries or logging', async () => {
  for (const failureAt of ['session', 'systems']) {
    const { fetcher, records } = createFetcher(
      failureAt === 'session'
        ? new Error('email-or-token-secret')
        : Response.json({ authenticated: true }),
      failureAt === 'systems' ? new Error('email-or-token-secret') : Response.json(ownerCatalog),
    );
    const result = await loadOwnerSystems(fetcher);
    assert.deepEqual(result, {
      authenticated: failureAt === 'systems',
      catalog: null,
    });
    assert.equal(records.length, failureAt === 'systems' ? 2 : 1);
  }
  const aborted = new AbortController();
  aborted.abort();
  const { fetcher, records } = createFetcher(
    Response.json({ authenticated: true }),
    Response.json(ownerCatalog),
  );
  assert.deepEqual(await loadOwnerSystems(fetcher, aborted.signal), {
    authenticated: false,
    catalog: null,
  });
  assert.equal(records.length, 0);
});
