/**
 * Note ID utilities — re-exported from foundation layer.
 *
 * The canonical implementation lives in `src/domain/foundation/note-id.ts`
 * (zero external dependencies). This file re-exports it for backward compatibility.
 */

export {
  toNoteId,
  noteIdToRelativePath,
  relativePathToNoteId,
  noteIdToBasename,
  isAssetNoteId,
  toRouteSlug,
} from '../foundation/note-id';
