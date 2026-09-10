import type { APIRoute } from 'astro';
import { getBookmarksByCategory } from '../../utils/notes';
import { buildToolCatalogGroups } from '../../view-models/tools-catalog';

export const prerender = true;

export const GET: APIRoute = async () => {
  const catalog = buildToolCatalogGroups(getBookmarksByCategory());
  return new Response(JSON.stringify(catalog), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
