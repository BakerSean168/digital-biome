/**
 * Browser-side access to the Cloudflare Access protected `/api/private/*` endpoints.
 *
 * Everything here only decides what the UI may *hint at* (login vs logout control,
 * private link targets). The Access middleware on the server stays authoritative:
 * a stale or forged client value can never unlock data the server would refuse.
 */

export interface PrivateInfrastructure {
  values: Record<string, string>;
  links: Record<string, string>;
}

const PRIVATE_REQUEST: RequestInit = {
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
  redirect: 'manual',
};

const ALLOWED_PRIVATE_PROTOCOLS = new Set(['http:', 'https:', 'ssh:']);

/** Only absolute http(s)/ssh URLs with a host may become a private link target. */
export function allowedPrivateHref(value: string): string | null {
  try {
    const url = new URL(value);
    return ALLOWED_PRIVATE_PROTOCOLS.has(url.protocol) && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

/** Fail closed: anything but a well-formed v1 payload is treated as locked. */
export function parsePrivateInfrastructure(payload: unknown): PrivateInfrastructure | null {
  if (!isRecord(payload) || payload.version !== 1 || !isStringRecord(payload.links)) return null;
  if (payload.values !== undefined && !isStringRecord(payload.values)) return null;
  return { values: payload.values ?? {}, links: payload.links };
}

export async function fetchPrivateInfrastructure(
  fetcher: typeof fetch = fetch,
): Promise<PrivateInfrastructure | null> {
  try {
    const response = await fetcher('/api/private/infrastructure', PRIVATE_REQUEST);
    if (!response.ok) return null;
    return parsePrivateInfrastructure(await response.json());
  } catch {
    return null;
  }
}

let privateInfrastructure: Promise<PrivateInfrastructure | null> | undefined;

/** Memoized per page; a locked (null) result is not kept, so a later call may retry. */
export function getPrivateInfrastructure(): Promise<PrivateInfrastructure | null> {
  privateInfrastructure ??= fetchPrivateInfrastructure().then((payload) => {
    if (!payload) privateInfrastructure = undefined;
    return payload;
  });
  return privateInfrastructure;
}

/** One uncached `/api/private/session` probe; `true` only for `{ authenticated: true }`. */
export async function probeSession(
  fetcher: typeof fetch = fetch,
  init: RequestInit = PRIVATE_REQUEST,
): Promise<boolean> {
  try {
    const response = await fetcher('/api/private/session', init);
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return isRecord(payload) && payload.authenticated === true;
  } catch {
    return false;
  }
}

const SESSION_HINT_KEY = 'biome:access-session';
const SESSION_HINT_TTL_MS = 5 * 60 * 1000;

function readSessionHint(): boolean | null {
  try {
    const hint: unknown = JSON.parse(sessionStorage.getItem(SESSION_HINT_KEY) ?? 'null');
    if (!isRecord(hint) || typeof hint.authenticated !== 'boolean') return null;
    if (typeof hint.at !== 'number' || Date.now() - hint.at > SESSION_HINT_TTL_MS) return null;
    return hint.authenticated;
  } catch {
    return null;
  }
}

function writeSessionHint(authenticated: boolean): void {
  try {
    sessionStorage.setItem(SESSION_HINT_KEY, JSON.stringify({ authenticated, at: Date.now() }));
  } catch {
    // Storage may be unavailable (private mode, quota); the probe simply runs next time.
  }
}

/** Forget the cached session hint, e.g. right before navigating to login or logout. */
export function clearSessionHint(): void {
  try {
    sessionStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Nothing cached.
  }
}

let session: Promise<boolean> | undefined;

/**
 * Whether the visitor appears to hold an Access session, for UI hints only.
 * Cached in sessionStorage for a few minutes so anonymous page views do not
 * invoke the Pages Function on every navigation.
 */
export function getSession(): Promise<boolean> {
  session ??= (async () => {
    const cached = readSessionHint();
    if (cached !== null) return cached;
    const authenticated = await probeSession();
    writeSessionHint(authenticated);
    return authenticated;
  })();
  return session;
}
