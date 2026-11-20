import type { APIRoute } from 'astro';
import { getInfrastructureServiceSearchIndex } from '../../utils/infrastructure-services';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      version: 1,
      services: getInfrastructureServiceSearchIndex(),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
