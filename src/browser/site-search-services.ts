import { hydratePrivateServiceTargets } from './site-search-private';
import { isServiceResult, type ServiceResult } from './site-search-results';

export interface SiteSearchServices {
  readonly list: () => readonly ServiceResult[];
  readonly load: () => Promise<void>;
  readonly hydratePrivateTargets: () => Promise<void>;
}

/** Public launcher index and the protected target lookup have separate data ownership. */
export function createSiteSearchServices(fetcher: typeof fetch = fetch): SiteSearchServices {
  let services: ServiceResult[] = [];
  let serviceIndexPromise: Promise<void> | null = null;
  let privateServiceTargetsResolved = false;

  const load = async (): Promise<void> => {
    if (services.length > 0) return;
    if (!serviceIndexPromise) {
      serviceIndexPromise = (async () => {
        try {
          const response = await fetcher('/data/system-launcher-index.json', {
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) return;
          const payload: unknown = await response.json();
          if (typeof payload !== 'object' || payload === null || !('services' in payload)) return;
          const entries = (payload as { services?: unknown }).services;
          if (!Array.isArray(entries) || !entries.every(isServiceResult)) return;
          services = entries;
        } catch {
          // Navigation commands and Pagefind remain available without the service index.
        }
      })();
    }
    await serviceIndexPromise;
  };

  const hydratePrivateTargets = async (): Promise<void> => {
    await load();
    if (privateServiceTargetsResolved || !services.some((service) => service.privateRef)) return;
    privateServiceTargetsResolved = await hydratePrivateServiceTargets(services, fetcher);
  };

  return { list: () => services, load, hydratePrivateTargets };
}
