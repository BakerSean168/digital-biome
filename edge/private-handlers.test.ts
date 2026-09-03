import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, type JWK } from 'jose';
import { onRequest as privateMiddleware } from '../functions/api/private/_middleware';
import { onRequestGet as getPrivateInfrastructure } from '../functions/api/private/infrastructure';

const KID = 'test-key-1';
const TEAM_DOMAIN = 'https://access-team.cloudflareaccess.com';
const AUDIENCE = 'test-aud';

let jwks: { keys: JWK[] };
let privateKey: CryptoKey;

async function signValidToken() {
  return new SignJWT({ email: 'jane@example.com', type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(TEAM_DOMAIN)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30s')
    .setSubject('sub-jane')
    .sign(privateKey);
}

async function withMockJwks(callback: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    assert.ok(url.endsWith('/cdn-cgi/access/certs'), `expected JWKS URL, got ${url}`);
    return Response.json(jwks);
  };
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function context(env: Record<string, string>, headers: Record<string, string> = {}) {
  return {
    request: new Request('https://example.test/api/private/session', { headers }),
    env,
    data: {} as Record<string, unknown>,
    next: async () => new Response('proxied', { status: 200 }),
  } as any;
}

describe('private /_middleware', () => {
  before(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const publicJwk = await exportJWK(keyPair.publicKey);
    jwks = { keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] };
  });

  test('blocks requests with a broken Access configuration', async () => {
    const response = await privateMiddleware(context(
      {
        CF_ACCESS_TEAM_DOMAIN: 'https://example.com',
        CF_ACCESS_AUD: AUDIENCE,
      },
      { 'Cf-Access-Jwt-Assertion': 'dummy-token' },
    ));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'access_configuration_invalid', message: 'Cloudflare Access team domain is invalid.' },
    });
  });

  test('blocks requests without an Access token', async () => {
    const response = await privateMiddleware(context({
      CF_ACCESS_TEAM_DOMAIN: 'access-team.cloudflareaccess.com',
      CF_ACCESS_AUD: AUDIENCE,
    }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    const body = await response.json() as any;
    assert.equal(body.error.code, 'access_token_missing');
  });

  test('passes verified identities through and sets the data context', async () => {
    const token = await signValidToken();
    const ctx = context(
      { CF_ACCESS_TEAM_DOMAIN: 'access-team.cloudflareaccess.com', CF_ACCESS_AUD: AUDIENCE },
      { 'Cf-Access-Jwt-Assertion': token },
    );
    await withMockJwks(async () => {
      const response = await privateMiddleware(ctx);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'proxied');
    });
    assert.equal((ctx.data.accessIdentity as any)?.email, 'jane@example.com');
  });
});

describe('private /infrastructure', () => {
  test('serves parsed private infrastructure values', async () => {
    const response = await getPrivateInfrastructure(context({
      PRIVATE_INFRASTRUCTURE_JSON: JSON.stringify({
        version: 1,
        values: { 'vps.example.ip': '192.0.2.10' },
        links: { 'host-example.links.ssh': 'ssh://admin@192.0.2.10' },
      }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const body = await response.json() as any;
    assert.equal(body.version, 1);
    assert.equal(body.values['vps.example.ip'], '192.0.2.10');
  });

  test('returns a config error for invalid payloads instead of leaking data', async () => {
    const response = await getPrivateInfrastructure(context({
      PRIVATE_INFRASTRUCTURE_JSON: JSON.stringify({
        version: 1,
        values: { 'bad key with spaces': 'x' },
        links: {},
      }),
    }));
    assert.equal(response.status, 500);
    const body = await response.json() as any;
    assert.equal(body.error.code, 'private_infrastructure_configuration_invalid');
  });
});
