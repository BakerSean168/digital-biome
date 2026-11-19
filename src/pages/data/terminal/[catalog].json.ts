import { getResourceCollection } from '../../../repositories/resource-collections-repository';
import type { ResourceView } from '../../../domain/resource-collections';
import type { APIRoute, GetStaticPaths } from 'astro';
import {
  terminalNotes,
  terminalExternal,
  terminalInfrastructure,
} from '../../../repositories/terminal-repository';
import { toCompactNoteRow } from '../../../view-models/terminal-object';
export const getStaticPaths: GetStaticPaths = () =>
  [
    'notes',
    'external',
    'services',
    'hosts',
    'network',
    'bookmarks',
    'blogroll',
    'carry',
    'defaults',
  ].map((catalog) => ({ params: { catalog } }));
export const GET: APIRoute = async ({ params }) =>
  new Response(
    JSON.stringify(
      ['bookmarks', 'blogroll', 'carry', 'defaults'].includes(params.catalog ?? '')
        ? getResourceCollection(params.catalog as ResourceView)
        : params.catalog === 'notes'
          ? (await terminalNotes()).map(toCompactNoteRow)
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
