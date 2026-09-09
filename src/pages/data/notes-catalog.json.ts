import type { APIRoute } from 'astro';
import { getPublicNotes } from '../../utils/notes';
import { sortNoteCatalog, toNoteCatalogItem } from '../../view-models/note-list-item';

export const prerender = true;

export const GET: APIRoute = async () => {
  const notes = await getPublicNotes();
  const catalog = sortNoteCatalog(notes.map(note => toNoteCatalogItem(note)));

  return new Response(JSON.stringify(catalog), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
};
