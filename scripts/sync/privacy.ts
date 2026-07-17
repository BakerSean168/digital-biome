import fs from 'node:fs';
import path from 'node:path';

interface UpstreamAssetLink {
  visibility?: unknown;
  url?: unknown;
}

interface UpstreamAsset {
  links?: unknown;
}

export function loadProtectedInfrastructureUrls(upstreamGeneratedPath: string): Set<string> {
  const assetIndexPath = path.resolve(
    process.cwd(),
    upstreamGeneratedPath,
    'knowledge-index',
    'asset-index.json',
  );
  if (!fs.existsSync(assetIndexPath)) return new Set();

  const parsed: unknown = JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'));
  if (!Array.isArray(parsed)) return new Set();

  const protectedUrls = new Set<string>();
  for (const item of parsed as UpstreamAsset[]) {
    if (!Array.isArray(item.links)) continue;
    for (const link of item.links as UpstreamAssetLink[]) {
      if (
        (link.visibility === 'internal' || link.visibility === 'private') &&
        typeof link.url === 'string' &&
        link.url.length >= 4
      ) {
        protectedUrls.add(link.url);
      }
    }
  }
  return protectedUrls;
}
