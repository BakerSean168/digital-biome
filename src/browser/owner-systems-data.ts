import { personalSystemAccessTier } from '../config/personal-systems-access';

/**
 * The public /systems page must never import the producer's private catalog.
 * This adapter accepts only authenticated runtime responses and projects the
 * minimum view data, discarding all unrecognized properties.
 */
export type OwnerRelation = 'canonical' | 'transitional' | 'archived' | 'external';

export interface OwnerRepository {
  id: string;
  relation: OwnerRelation;
  webUrl?: string;
}

export interface OwnerDomain {
  id: string;
  name: string;
  repositories: OwnerRepository[];
}

export interface OwnerSystemsPayload {
  version: 1;
  access: 'owner';
  domains: OwnerDomain[];
}

export interface OwnerSystemsAccess {
  authenticated: boolean;
  catalog: OwnerSystemsPayload | null;
}

const denied: OwnerSystemsAccess = { authenticated: false, catalog: null };
const relations = new Set<OwnerRelation>(['canonical', 'transitional', 'archived', 'external']);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyText(value: unknown, maxLength = 250): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isSafeOwnerRepositoryUrl(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function parseOwnerSystemsPayload(value: unknown): OwnerSystemsPayload | null {
  if (
    !record(value) ||
    value.version !== 1 ||
    value.access !== 'owner' ||
    !Array.isArray(value.domains)
  ) {
    return null;
  }
  if (value.domains.length > 1000) return null;

  const domains: OwnerDomain[] = [];
  const seen = new Set<string>();

  for (const input of value.domains) {
    if (
      !record(input) ||
      !nonEmptyText(input.id) ||
      !nonEmptyText(input.name) ||
      personalSystemAccessTier(input.id) !== 'owner' ||
      !Array.isArray(input.repositories) ||
      input.repositories.length > 5000 ||
      seen.has(input.id)
    )
      return null;
    seen.add(input.id);

    const repositories: OwnerRepository[] = [];
    for (const item of input.repositories) {
      if (
        !record(item) ||
        !nonEmptyText(item.id) ||
        typeof item.relation !== 'string' ||
        !relations.has(item.relation as OwnerRelation) ||
        (item.webUrl !== undefined && !isSafeOwnerRepositoryUrl(item.webUrl))
      )
        return null;
      repositories.push({
        id: item.id,
        relation: item.relation as OwnerRelation,
        ...(item.webUrl === undefined ? {} : { webUrl: item.webUrl as string }),
      });
    }
    domains.push({ id: input.id, name: input.name, repositories });
  }

  return { version: 1, access: 'owner', domains };
}

const privateRequest = (signal: AbortSignal): RequestInit => ({
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
  redirect: 'manual',
  cache: 'no-store',
  signal,
});

/** Never retry a denied/failed request automatically or log the payload/error. */
export async function loadOwnerSystems(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<OwnerSystemsAccess> {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000);
  if (requestSignal.aborted) return denied;

  try {
    const session = await fetcher('/api/private/session', privateRequest(requestSignal));
    if (!session.ok || requestSignal.aborted) return denied;
    const sessionPayload: unknown = await session.json();
    if (!record(sessionPayload) || sessionPayload.authenticated !== true || requestSignal.aborted)
      return denied;
  } catch {
    return denied;
  }

  // Session verification is only a display hint; the server's Access middleware
  // remains authoritative for the separate protected catalog request.
  try {
    if (requestSignal.aborted) return denied;
    const response = await fetcher('/api/private/systems', privateRequest(requestSignal));
    if (!response.ok || requestSignal.aborted) return { authenticated: true, catalog: null };
    const raw: unknown = await response.json();
    if (requestSignal.aborted) return denied;
    return { authenticated: true, catalog: parseOwnerSystemsPayload(raw) };
  } catch {
    return { authenticated: true, catalog: null };
  }
}
