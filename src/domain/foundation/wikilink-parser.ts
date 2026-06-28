/**
 * Wikilink syntax parser — zero external dependencies.
 *
 * Supported syntaxes:
 *   [[Target]]
 *   [[Target|Display Text]]
 *   [[Target\|Display Text]]   (escaped pipe in Obsidian tables)
 *   [[Target#Heading]]
 *   [[Target^block-id]]
 *   ![[image.png]]              (image wikilink — excluded from note links)
 */

export interface ParsedWikilink {
  /** The raw target string (before trimming anchors) */
  rawTarget: string;
  /** Resolution target with heading/block ref stripped */
  target: string;
  /** Display text if present */
  display?: string;
  /** Heading anchor from `#heading`, if any */
  heading?: string;
  /** Block ref from `^block-id`, if any */
  blockRef?: string;
  /** Whether this is an image embed `![[...]]` */
  isImage: boolean;
  /** Start index in the original text */
  startIndex: number;
  /** Full match length */
  length: number;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?)$/i;

function splitTargetAndDisplay(inner: string): { rawTarget: string; display?: string } {
  for (let index = 0; index < inner.length; index++) {
    const char = inner[index];
    if (char === '\\' && inner[index + 1] === '|') {
      return {
        rawTarget: inner.slice(0, index),
        display: inner.slice(index + 2),
      };
    }
    if (char === '|') {
      return {
        rawTarget: inner.slice(0, index),
        display: inner.slice(index + 1),
      };
    }
  }

  return { rawTarget: inner };
}

function stripAnchorParts(rawTarget: string): Pick<ParsedWikilink, 'target' | 'heading' | 'blockRef'> {
  let target = rawTarget.trim();
  let heading: string | undefined;
  let blockRef: string | undefined;

  const hashIndex = target.indexOf('#');
  if (hashIndex !== -1) {
    const anchorPart = target.slice(hashIndex + 1).trim();
    target = target.slice(0, hashIndex).trim();
    const caretIndex = anchorPart.indexOf('^');
    if (caretIndex !== -1) {
      heading = anchorPart.slice(0, caretIndex).trim() || undefined;
      blockRef = anchorPart.slice(caretIndex + 1).trim() || undefined;
    } else {
      heading = anchorPart || undefined;
    }
    return { target, heading, blockRef };
  }

  const caretIndex = target.indexOf('^');
  if (caretIndex !== -1) {
    blockRef = target.slice(caretIndex + 1).trim() || undefined;
    target = target.slice(0, caretIndex).trim();
  }

  return { target, heading, blockRef };
}

/**
 * Parse all wikilinks from a text string.
 * Image wikilinks (`![[image.png]]`) are included but flagged with `isImage`.
 */
export function parseWikilinks(text: string): ParsedWikilink[] {
  const results: ParsedWikilink[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openIndex = text.indexOf('[[', cursor);
    if (openIndex === -1) break;

    const isImage = openIndex > 0 && text[openIndex - 1] === '!';
    const startIndex = isImage ? openIndex - 1 : openIndex;
    const closeIndex = text.indexOf(']]', openIndex + 2);
    if (closeIndex === -1) break;

    const inner = text.slice(openIndex + 2, closeIndex);
    const { rawTarget, display } = splitTargetAndDisplay(inner);
    const trimmedTarget = rawTarget.trim();
    const { target, heading, blockRef } = stripAnchorParts(trimmedTarget);

    results.push({
      rawTarget: trimmedTarget,
      target,
      display: display?.trim() || undefined,
      heading,
      blockRef,
      isImage: isImage || IMAGE_EXT.test(trimmedTarget),
      startIndex,
      length: closeIndex + 2 - startIndex,
    });

    cursor = closeIndex + 2;
  }

  return results;
}

/**
 * Parse only note wikilinks (excluding images).
 */
export function parseNoteWikilinks(text: string): ParsedWikilink[] {
  return parseWikilinks(text).filter(link => !link.isImage && !IMAGE_EXT.test(link.rawTarget));
}
