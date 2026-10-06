import type { APIRoute, GetStaticPaths } from 'astro';
import {
  terminalNotes,
  terminalExternal,
  terminalInfrastructure,
} from '../../../repositories/terminal-repository';
export const getStaticPaths: GetStaticPaths = () =>
  ['notes', 'external', 'services', 'hosts', 'network'].map((catalog) => ({ params: { catalog } }));
export const GET: APIRoute = async ({ params }) =>
  new Response(
    JSON.stringify(
      params.catalog === 'notes'
        ? await terminalNotes()
        : params.catalog === 'external'
          ? terminalExternal()
          : terminalInfrastructure().filter((item) =>
              params.catalog === 'services'
                ? item.kind === 'service'
                : params.catalog === 'hosts'
                  ? item.kind === 'host'
                  : item.kind === 'network' || item.kind === 'platform',
            ),
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    },
  );
