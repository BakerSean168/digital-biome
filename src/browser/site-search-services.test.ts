import assert from 'node:assert/strict';
import test from 'node:test';
import { createSiteSearchServices } from './site-search-services';
import type { ServiceResult } from './site-search-results';

const publicService: ServiceResult = {
  type: 'service',
  label: 'SVC',
  title: 'Private Management',
  desc: 'Protected route',
  href: '/systems',
  aliases: ['private'],
  privateRef: 'service.links.admin',
  pinned: true,
};

test('public launcher index loads once and stays usable when Access denies a private lookup', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ url: String(url), init });
    if (String(url).startsWith('/data/')) {
      return Response.json({ services: [publicService] });
    }
    return new Response('Unauthorized', { status: 401 });
  };
  const services = createSiteSearchServices(fetcher as typeof fetch);
  await Promise.all([services.load(), services.load()]);
  assert.equal(requests.filter((item) => item.url.startsWith('/data/')).length, 1);
  assert.deepEqual(services.list(), [publicService]);
  await services.hydratePrivateTargets();
  assert.equal(services.list()[0].href, '/systems');
  const request = requests.find((item) => item.url === '/api/private/infrastructure');
  assert.equal(request?.init?.redirect, 'manual');
  assert.equal(request?.init?.credentials, 'same-origin');
});

test('private target hydration accepts only valid authorized URL schemes and can retry after denial', async () => {
  const protectedUrl = 'https://example.test/admin';
  const publicEntries = [
    publicService,
    { ...publicService, title: 'Untrusted Service', privateRef: 'service.links.other' },
  ];
  let authenticated = false;
  const fetcher = async (url: string | URL | Request): Promise<Response> => {
    if (String(url).startsWith('/data/')) return Response.json({ services: publicEntries });
    if (!authenticated) return new Response('Unauthorized', { status: 401 });
    return Response.json({
      version: 1,
      links: {
        'service.links.admin': protectedUrl,
        'service.links.other': 'javascript:alert(1)',
      },
    });
  };
  const services = createSiteSearchServices(fetcher as typeof fetch);
  await services.hydratePrivateTargets();
  assert.equal(services.list()[0].href, '/systems');
  authenticated = true;
  await services.hydratePrivateTargets();
  assert.equal(services.list()[0].href, protectedUrl);
  assert.equal(services.list()[1].href, '/systems');
});

test('invalid public catalog and invalid protected payloads cannot mutate browser targets', async () => {
  let publicFetches = 0;
  const invalidCatalog = createSiteSearchServices((async () => {
    publicFetches++;
    return Response.json({ services: [{ ...publicService, aliases: [null] }] });
  }) as typeof fetch);
  await invalidCatalog.load();
  assert.deepEqual(invalidCatalog.list(), []);
  await invalidCatalog.load();
  assert.equal(publicFetches, 1);

  const services = createSiteSearchServices((async (url: string) => {
    if (url.startsWith('/data/')) return Response.json({ services: [publicService] });
    return Response.json({
      version: 1,
      links: { 'service.links.admin': { value: 'https://bad' } },
    });
  }) as typeof fetch);
  await services.hydratePrivateTargets();
  assert.equal(services.list()[0].href, '/systems');
});
