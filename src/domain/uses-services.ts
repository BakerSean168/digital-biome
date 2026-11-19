import type { NoteIndexEntry } from '../types/knowledge-index';
import type { TerminalObject } from '../view-models/terminal-object';
import { selectResourceEntries, toResourceObject } from './resource-collections';

/** Personal copy joins infrastructure only by a deliberately authored public ID. */
export function mergeUsesServices(
  infrastructure: TerminalObject[],
  notes: readonly NoteIndexEntry[],
): TerminalObject[] {
  const resources = infrastructure.map((resource) => ({ ...resource }));
  const linked = new Set<string>();
  for (const note of selectResourceEntries(notes, 'uses')) {
    if (!note.filePath.startsWith('uses/services/')) continue;
    const card = toResourceObject(note);
    if (!note.infraResourceId) {
      resources.push(card);
      continue;
    }
    const resource = resources.find(
      (item) => item.id === note.infraResourceId && item.kind === 'service',
    );
    if (!resource || linked.has(resource.id)) {
      throw new Error('Unknown or duplicate public service association: ' + note.infraResourceId);
    }
    linked.add(resource.id);
    resource.title = card.title;
    resource.description = card.description;
    resource.relations = [...resource.relations, { title: '使用记录', href: card.href }];
  }
  return resources;
}
