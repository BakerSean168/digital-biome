import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/webhooks/github';

async function withMockFetch(
  handler: typeof fetch,
  callback: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function request(
  body: Uint8Array = new TextEncoder().encode('{"action":"opened"}'),
  overrides: Record<string, string> = {},
): Request {
  return new Request('https://digital-biome.pages.dev/api/webhooks/github', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-github-event': 'pull_request',
      'x-github-delivery': '11111111-1111-4111-8111-111111111111',
      'x-github-hook-id': '672262578',
      'x-hub-signature-256': `sha256=${'a'.repeat(64)}`,
      ...overrides,
    },
    body,
  });
}

function context(req: Request) {
  return { request: req, env: {}, params: {}, data: {}, waitUntil() {}, next() {} } as any;
}

test('GitHub webhook relay preserves raw body and only the verifier headers', async () => {
  const raw = new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x31, 0x7d]);
  await withMockFetch(async (input, init) => {
    assert.equal(String(input), 'https://gcp-dev-01.taile92a8e.ts.net:8443/github/webhook');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'manual');
    assert.deepEqual(new Uint8Array(init?.body as ArrayBuffer), raw);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-github-event'), 'pull_request');
    assert.equal(headers.get('x-github-delivery'), '11111111-1111-4111-8111-111111111111');
    assert.equal(headers.get('x-github-hook-id'), '672262578');
    assert.equal(headers.get('x-hub-signature-256'), `sha256=${'a'.repeat(64)}`);
    assert.equal(headers.get('authorization'), null);
    assert.equal(headers.get('cf-connecting-ip'), null);
    return Response.json({ accepted: true }, { status: 202 });
  }, async () => {
    const response = await onRequest(context(request(raw)));
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { accepted: true });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('GitHub webhook relay fails closed before forwarding malformed requests', async () => {
  let fetchCalls = 0;
  await withMockFetch(async () => {
    fetchCalls += 1;
    return new Response(null, { status: 500 });
  }, async () => {
    const getResponse = await onRequest(context(new Request('https://example.test', { method: 'GET' })));
    assert.equal(getResponse.status, 405);

    const badType = await onRequest(context(request(undefined, { 'content-type': 'application/jsonp' })));
    assert.equal(badType.status, 415);

    const badSignature = await onRequest(
      context(request(undefined, { 'x-hub-signature-256': `sha256=${'z'.repeat(64)}` })),
    );
    assert.equal(badSignature.status, 400);

    const badEvent = await onRequest(context(request(undefined, { 'x-github-event': 'issues' })));
    assert.equal(badEvent.status, 400);

    const missingDeliveryHeaders = await onRequest(context(request(undefined, { 'x-github-delivery': '' })));
    assert.equal(missingDeliveryHeaders.status, 400);

    const malformedDelivery = await onRequest(
      context(request(undefined, { 'x-github-delivery': 'not-a-uuid' })),
    );
    assert.equal(malformedDelivery.status, 400);

    const malformedHookId = await onRequest(context(request(undefined, { 'x-github-hook-id': '12x' })));
    assert.equal(malformedHookId.status, 400);

    for (const invalidLength of ['-1', 'NaN', '1.5', '+1', '01']) {
      const badLength = await onRequest(context(request(undefined, { 'content-length': invalidLength })));
      assert.equal(badLength.status, 400);
    }

    const oversized = await onRequest(
      context(request(new Uint8Array(1024 * 1024 + 1), { 'content-length': String(1024 * 1024 + 1) })),
    );
    assert.equal(oversized.status, 413);
    assert.equal(fetchCalls, 0);
  });
});

test('GitHub webhook relay enforces body limit while streaming without Content-Length', async () => {
  let fetchCalls = 0;
  await withMockFetch(async () => {
    fetchCalls += 1;
    return Response.json({ accepted: true }, { status: 202 });
  }, async () => {
    const chunk = new Uint8Array(600 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const req = new Request('https://digital-biome.pages.dev/api/webhooks/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': '22222222-2222-4222-8222-222222222222',
        'x-github-hook-id': '672262578',
        'x-hub-signature-256': `sha256=${'b'.repeat(64)}`,
      },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const response = await onRequest(context(req));
    assert.equal(response.status, 413);
    assert.equal(fetchCalls, 0);
  });
});

test('GitHub webhook relay converts verifier transport failure to 502 without inventing success', async () => {
  await withMockFetch(async () => {
    throw new Error('upstream unavailable');
  }, async () => {
    const response = await onRequest(context(request()));
    assert.equal(response.status, 502);
    const body = await response.json() as any;
    assert.equal(body.error.code, 'WEBHOOK_VERIFIER_UNAVAILABLE');
  });
});
