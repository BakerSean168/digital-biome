import { allowedPrivateHref, fetchPrivateInfrastructure } from './private-access';
import type { ServiceResult } from './site-search-results';

/** Fail closed: never alter public service fallbacks for unauthenticated or invalid responses. */
export async function hydratePrivateServiceTargets(
  services: ServiceResult[],
  fetcher: typeof fetch,
): Promise<boolean> {
  // Logged-out visitors retain safe /systems anchors.
  const payload = await fetchPrivateInfrastructure(fetcher);
  if (!payload) return false;
  for (const service of services) {
    if (!service.privateRef) continue;
    const href = allowedPrivateHref(payload.links[service.privateRef] || '');
    if (href) service.href = href;
  }
  return true;
}
