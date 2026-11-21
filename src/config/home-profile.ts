import { OTHER_TABS } from './other-pages';

/** A compact, non-resume introduction for the homepage. */
export const HOME_WORDS = [
  { word: 'programmer', href: '/projects' },
  { word: 'tinkerer', href: '/uses' },
  { word: 'gamer', href: '/now' },
  { word: 'reader', href: '/about' },
] as const;

/** The homepage is an index of individual pages, not a list of section containers.
 * Shortcut hints describe a sequence of separate steps: g + section, then local tab number.
 */
export const HOME_SLASH_LINKS = [
  { href: '/about', label: '/about', shortcut: 'g a' },
  { href: '/now', label: '/now', shortcut: 'g n' },
  { href: '/uses', label: '/uses', shortcut: 'g u' },
  { href: '/projects', label: '/projects', shortcut: 'g p' },
  { href: '/blog', label: '/blog', shortcut: 'g l 1' },
  { href: '/notes', label: '/notes', shortcut: 'g l 2' },
  ...OTHER_TABS.map((tab, index) => ({
    href: `/other#${tab.id}`,
    label: `/${tab.id}`,
    shortcut: `g o ${index + 1}`,
  })),
] as const;
