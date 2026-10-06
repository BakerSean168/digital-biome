import { parseTerminalCatalog } from '../src/view-models/terminal-object';
/** Assert the emitted page contains precisely the bounded initial objects. */
export function assertTerminalCatalogBoundary(
  html: string,
  payload: unknown,
  kind: string,
  limit: number,
): void {
  const catalog = parseTerminalCatalog(payload);
  const rows = [...html.matchAll(/data-terminal-kind="([^"]+)" data-terminal-id="([^"]+)"/g)]
    .filter((match) => match[1] === kind)
    .map((match) => match[2]);
  const expected = catalog
    .slice(0, limit)
    .map((item) => item.id.replaceAll('&', '&amp;').replaceAll('"', '&quot;'));
  if (JSON.stringify(rows) !== JSON.stringify(expected))
    throw new Error(`${kind}: SSR objects must match bounded catalog in order`);
  if (new Set(rows).size !== rows.length) throw new Error(`${kind}: duplicate SSR objects`);
}
