import type { ServiceResult } from './site-search-results';

type PrivateInfrastructurePayload = {
  version: 1;
  links: Record<string, string>;
};

function getAllowedPrivateHref(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'ssh:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}

/** Fail closed: never alter public service fallbacks for unauthenticated or invalid responses. */
export async function hydratePrivateServiceTargets(
  services: ServiceResult[],
  fetcher: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetcher('/api/private/infrastructure', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('version' in payload) ||
      payload.version !== 1 ||
      !('links' in payload) ||
      !isStringRecord(payload.links)
    ) {
      return false;
    }
    const privatePayload = payload as PrivateInfrastructurePayload;
    for (const service of services) {
      if (!service.privateRef) continue;
      const href = getAllowedPrivateHref(privatePayload.links[service.privateRef] || '');
      if (href) service.href = href;
    }
    return true;
  } catch {
    // Logged-out visitors retain safe /systems anchors.
    return false;
  }
}
