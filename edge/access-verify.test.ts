import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, type JWK } from 'jose';
import { verifyAccessRequest, type AccessAuthenticationError } from './access';

const KID = 'test-key-1';
const TEAM_DOMAIN = 'https://access-team.cloudflareaccess.com';
const TEAM_DOMAIN_INPUT = 'access-team.cloudflareaccess.com';
const AUDIENCE = 'test-aud';
const VALID_ENV = { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN_INPUT, CF_ACCESS_AUD: AUDIENCE };

let jwks: { keys: JWK[] };
let privateKey: CryptoKey;

async function signToken(payload: Record<string, unknown>, overrides: {
  audience?: string;
} = {}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(TEAM_DOMAIN)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30s')
    .setSubject(String(payload.sub ?? 'sub-user'))
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

async function expectAuthError(
  request: Request,
  env: typeof VALID_ENV,
  code: string,
  status: number,
) {
  await assert.rejects(
    verifyAccessRequest(request, env),
    (error: AccessAuthenticationError) => error.code === code && error.status === status,
  );
}

describe('verifyAccessRequest', () => {
  before(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const publicJwk = await exportJWK(keyPair.publicKey);
    jwks = { keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] };
  });

  test('rejects requests without an Access token', async () => {
    await expectAuthError(
      new Request('https://example.test/api/private/session'),
      VALID_ENV,
      'access_token_missing',
      401,
    );
  });

  test('reports missing audience as a configuration error', async () => {
    await expectAuthError(
      new Request('https://example.test/api/private/session', {
        headers: { 'Cf-Access-Jwt-Assertion': 'unused' },
      }),
      { ...VALID_ENV, CF_ACCESS_AUD: '' },
      'access_configuration_missing',
      500,
    );
  });

  test('reports an invalid team domain as a configuration error', async () => {
    await expectAuthError(
      new Request('https://example.test/api/private/session', {
        headers: { 'Cf-Access-Jwt-Assertion': 'unused' },
      }),
      { ...VALID_ENV, CF_ACCESS_TEAM_DOMAIN: 'https://example.com' },
      'access_configuration_invalid',
      500,
    );
  });

  test('returns the identity for a valid Access token', async () => {
    const token = await signToken({ email: 'jane@example.com', type: 'app', sub: 'sub-jane' });
    await withMockJwks(async () => {
      const identity = await verifyAccessRequest(
        new Request('https://example.test/api/private/session', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        }),
        VALID_ENV,
      );
      assert.deepEqual(identity, { email: 'jane@example.com', subject: 'sub-jane' });
    });
  });

  test('rejects tokens that are not app sessions', async () => {
    const token = await signToken({ email: 'jane@example.com', type: 'user', sub: 'sub-jane' });
    await withMockJwks(async () => {
      await expectAuthError(
        new Request('https://example.test/api/private/session', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        }),
        VALID_ENV,
        'access_token_invalid',
        401,
      );
    });
  });

  test('rejects tokens with malformed email claims', async () => {
    const token = await signToken({ email: 'not-an-email', type: 'app', sub: 'sub-jane' });
    await withMockJwks(async () => {
      await expectAuthError(
        new Request('https://example.test/api/private/session', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        }),
        VALID_ENV,
        'access_token_invalid',
        401,
      );
    });
  });

  test('rejects tokens issued for another audience', async () => {
    const token = await signToken(
      { email: 'jane@example.com', type: 'app', sub: 'sub-jane' },
      { audience: 'other-aud' },
    );
    await withMockJwks(async () => {
      await expectAuthError(
        new Request('https://example.test/api/private/session', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        }),
        VALID_ENV,
        'access_token_invalid',
        401,
      );
    });
  });

  test('rejects garbage tokens', async () => {
    await withMockJwks(async () => {
      await expectAuthError(
        new Request('https://example.test/api/private/session', {
          headers: { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' },
        }),
        VALID_ENV,
        'access_token_invalid',
        401,
      );
    });
  });
});
