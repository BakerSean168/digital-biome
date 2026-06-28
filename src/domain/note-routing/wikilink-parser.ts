/**
 * Wikilink syntax parser — re-exported from foundation layer.
 *
 * The canonical implementation lives in `src/domain/foundation/wikilink-parser.ts`
 * (zero external dependencies). This file re-exports it for backward compatibility.
 */

export { parseWikilinks, parseNoteWikilinks } from '../foundation/wikilink-parser';
export type { ParsedWikilink } from '../foundation/wikilink-parser';
