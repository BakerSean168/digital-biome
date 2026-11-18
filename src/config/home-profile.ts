/** A compact, non-resume introduction for the homepage. */
export const HOME_WORDS = [
  { word: 'programmer', href: '/projects' },
  { word: 'tinkerer', href: '/uses' },
  { word: 'gamer', href: '/now' },
  { word: 'reader', href: '/about' },
] as const;

/** "g + key" is the site's existing global navigation shortcut. */
export const HOME_SLASH_LINKS = [
  { href: '/about', label: '/about', shortcut: 'g a' },
  { href: '/now', label: '/now', shortcut: 'g n' },
  { href: '/uses', label: '/uses', shortcut: 'g u' },
  { href: '/projects', label: '/projects', shortcut: 'g p' },
  { href: '/blog', label: '/blog', shortcut: null },
  { href: '/notes', label: '/notes', shortcut: 'g l' },
] as const;
