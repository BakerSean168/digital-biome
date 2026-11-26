/** Dashboard is authored as a plain Markdown list, never a second catalog. */
export interface DashboardLink {
  title: string;
  href: string;
  hostname: string;
  description: string;
  noteTarget?: string;
}

export interface DashboardGroup {
  title: string;
  level: 2 | 3;
  links: DashboardLink[];
}

export function parseDashboardBody(body: string): DashboardGroup[] {
  const groups: DashboardGroup[] = [];
  let current: DashboardGroup | undefined;
  for (const [index, line] of body.replace(/\r\n/g, '\n').split('\n').entries()) {
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = { title: heading[2], level: heading[1].length === 2 ? 2 : 3, links: [] };
      groups.push(current);
      continue;
    }
    // The page may contain an H1 and an author-only maintenance callout.
    if (!line.trim() || line.startsWith('>') || /^#\s/.test(line)) continue;
    const item = /^\s*[-*]\s+\[((?:\\.|[^\]])+)\]\((?:<([^>]+)>|([^\s)]+))\)\s*(.*)$/.exec(line);
    if (!current || !item)
      throw new Error(`pages/dashboard.md: invalid entry at line ${index + 1}`);
    const href = item[2] ?? item[3];
    // A producer-redacted link cannot become a public clickable target.
    if (href === 'private://redacted') continue;
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      throw new Error(`pages/dashboard.md: invalid URL at line ${index + 1}`);
    }
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some((key) =>
        /^(token|api[_-]?key|api|auth|access[_-]?token|secret|password|session)$/i.test(key),
      )
    ) {
      throw new Error(`pages/dashboard.md: unsafe URL at line ${index + 1}`);
    }
    const note = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*$/.exec(item[4]);
    const description = (note ? item[4].slice(0, note.index) : item[4])
      .replace(/\s*·\s*$/, '')
      .replace(/^\s*[—–·-]+\s*/, '')
      .trim();
    current.links.push({
      title: item[1].replace(/\\([[\]\\])/g, '$1'),
      href: url.href,
      hostname: url.hostname,
      description,
      ...(note ? { noteTarget: note[1] } : {}),
    });
  }
  return groups;
}
