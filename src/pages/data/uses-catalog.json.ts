import type { APIRoute } from 'astro';
import { getBookmarksByCategory } from '../../repositories/bookmarks-repository';
import { buildUsesCatalogGroups } from '../../view-models/uses-catalog';

export const prerender = true;

export const GET: APIRoute = async () => {
  const catalog = buildUsesCatalogGroups(getBookmarksByCategory());
  return new Response(JSON.stringify(catalog), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
