import type { APIRoute } from 'astro';
import { getPublicNotes } from '../../utils/notes';
import { sortNoteCatalog, toNoteCatalogItem } from '../../view-models/note-list-item';

export const prerender = true;

export const GET: APIRoute = async () => {
  const notes = await getPublicNotes();
  const catalog = sortNoteCatalog(notes.map((note) => toNoteCatalogItem(note)));

  // The browser reconstructs note hrefs from ids; transmitting both repeats
  // a deterministic path for every entry in the large, lazy-loaded catalog.
  const transport = catalog.map(({ href: _derivedHref, ...item }) => item);

  return new Response(JSON.stringify(transport), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
