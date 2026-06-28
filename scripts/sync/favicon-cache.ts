/**
 * Favicon caching — downloads favicons for URLs found in frontmatter.
 *
 * Uses Google S2 favicon API.
 * Optional step: skipped by default, enabled with --with-favicons flag.
 */

import fs from 'fs';
import path from 'path';
import { fetch } from 'undici';
import type { SyncStats } from './types';

export async function cacheFavicon(
  urlStr: string,
  faviconsDest: string,
  stats: SyncStats
): Promise<void> {
  if (!urlStr) return;
  try {
    const domain = new URL(urlStr).hostname;
    if (!fs.existsSync(faviconsDest)) {
      fs.mkdirSync(faviconsDest, { recursive: true });
    }
    const destPath = path.join(faviconsDest, `${domain}.png`);
    if (fs.existsSync(destPath)) {
      return; // Already cached
    }
    const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const res = await fetch(iconUrl);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(destPath, new Uint8Array(arrayBuffer));
      stats.faviconsCached++;
    } else {
      stats.errors.push(`Failed to fetch favicon for ${domain}: ${res.statusText}`);
    }
  } catch (err) {
    stats.errors.push(`Error caching favicon for url ${urlStr}: ${err}`);
  }
}
