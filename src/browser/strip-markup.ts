const namedEntities: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  copy: '©',
  gt: '>',
  hellip: '…',
  lt: '<',
  mdash: '—',
  nbsp: '\u00a0',
  ndash: '–',
  quot: '"',
  reg: '®',
  trade: '™',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);?/gi, (reference, token: string) => {
    if (token[0] === '#') {
      const isHex = token[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return reference;
    }

    return namedEntities[token.toLowerCase()] || reference;
  });
}

function stripTags(value: string): string {
  return value
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/<\/?[a-z][^>]*$/gi, '');
}

export function stripMarkupToText(value: string): string {
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(value, 'text/html');
    return document.body.textContent || '';
  }

  return decodeEntities(stripTags(value));
}
