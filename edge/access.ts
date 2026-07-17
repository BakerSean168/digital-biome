import { createRemoteJWKSet, jwtVerify } from 'jose';

const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';
const ACCESS_DOMAIN_SUFFIX = '.cloudflareaccess.com';

export interface AccessIdentity {
  email: string;
  subject: string;
}

export type AccessContextData = Record<string, unknown> & {
  accessIdentity: AccessIdentity;
};

export class AccessAuthenticationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 401 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'AccessAuthenticationError';
  }
}

const remoteJwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function normalizeAccessTeamDomain(value: string): string {
  const candidate = value.trim();
  if (!candidate) {
    throw new AccessAuthenticationError(
      'access_configuration_missing',
      500,
      'Cloudflare Access is not configured.',
    );
  }

  let url: URL;
  try {
    url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
  } catch {
    throw new AccessAuthenticationError(
      'access_configuration_invalid',
      500,
      'Cloudflare Access team domain is invalid.',
    );
  }

  const hostname = url.hostname.toLowerCase();
  const teamName = hostname.slice(0, -ACCESS_DOMAIN_SUFFIX.length);
  const isValidTeamName = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(teamName);
  const hasUnexpectedUrlParts =
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search !== '' ||
    url.hash !== '';

  if (!hostname.endsWith(ACCESS_DOMAIN_SUFFIX) || !isValidTeamName || hasUnexpectedUrlParts) {
    throw new AccessAuthenticationError(
      'access_configuration_invalid',
      500,
      'Cloudflare Access team domain is invalid.',
    );
  }

  return `https://${hostname}`;
}

export function getSafeNextPath(value: string | null, fallback = '/'): string {
  if (
    !value ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL('https://local.invalid');
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.pathname === '/api/private/enter') {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

function getRemoteJwks(teamDomain: string) {
  const jwksUrl = `${teamDomain}/cdn-cgi/access/certs`;
  let remoteJwks = remoteJwksByUrl.get(jwksUrl);
  if (!remoteJwks) {
    remoteJwks = createRemoteJWKSet(new URL(jwksUrl));
    remoteJwksByUrl.set(jwksUrl, remoteJwks);
  }
  return remoteJwks;
}

export async function verifyAccessRequest(
  request: Request,
  env: Pick<Env, 'CF_ACCESS_TEAM_DOMAIN' | 'CF_ACCESS_AUD'>,
): Promise<AccessIdentity> {
  const token = request.headers.get(ACCESS_JWT_HEADER)?.trim();
  if (!token) {
    throw new AccessAuthenticationError(
      'access_token_missing',
      401,
      'A valid Cloudflare Access session is required.',
    );
  }

  const teamDomain = normalizeAccessTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = env.CF_ACCESS_AUD.trim();
  if (!audience) {
    throw new AccessAuthenticationError(
      'access_configuration_missing',
      500,
      'Cloudflare Access is not configured.',
    );
  }

  try {
    const { payload } = await jwtVerify(token, getRemoteJwks(teamDomain), {
      algorithms: ['RS256'],
      audience,
      issuer: teamDomain,
      requiredClaims: ['email', 'exp', 'iat', 'sub', 'type'],
    });

    if (
      payload.type !== 'app' ||
      typeof payload.email !== 'string' ||
      !payload.email.includes('@') ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0
    ) {
      throw new Error('Unexpected Access token claims.');
    }

    return {
      email: payload.email,
      subject: payload.sub,
    };
  } catch {
    throw new AccessAuthenticationError(
      'access_token_invalid',
      401,
      'A valid Cloudflare Access session is required.',
    );
  }
}
