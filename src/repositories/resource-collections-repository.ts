import {
  findDefaultConflicts,
  selectResourceEntries,
  toResourceObject,
  type ResourceView,
} from '../domain/resource-collections';
import { getAllNoteEntries } from './knowledge-index-loader';

export function getResourceCollection(view: ResourceView) {
  if (view === 'defaults') {
    const conflicts = findDefaultConflicts(getAllNoteEntries());
    if (conflicts.length) throw new Error('Conflicting defaults: ' + conflicts.join(', '));
  }
  return selectResourceEntries(getAllNoteEntries(), view).map(toResourceObject);
}

export function getResourceDefaultConflicts() {
  return findDefaultConflicts(getAllNoteEntries());
}
