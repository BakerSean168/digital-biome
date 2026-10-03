import type { APIRoute } from 'astro';
import { getPortalServiceSearchIndex } from '../../utils/personal-systems';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      version: 1,
      services: getPortalServiceSearchIndex(),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
