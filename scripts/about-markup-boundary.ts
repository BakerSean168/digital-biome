export interface AboutMarkupBoundaryOptions {
  contributionDays: number;
}

function count(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

export function assertAboutMarkupBoundary(
  aboutHtml: string,
  tagsHtml: string,
  options: AboutMarkupBoundaryOptions,
): void {
  const contributionCells = count(aboutHtml, /class="contribution-cell"/g);
  if (contributionCells !== options.contributionDays) {
    throw new Error(`Expected ${options.contributionDays} compact contribution cells, found ${contributionCells}.`);
  }
  if (!aboutHtml.includes('data-heatmap-grid') || !aboutHtml.includes('role="img"')) {
    throw new Error('Contribution heatmap must retain one labelled semantic owner.');
  }

  const tagCountMatch = tagsHtml.match(/data-tag-count="(\d+)"/);
  if (!tagCountMatch) throw new Error('Tag directory must publish its SSR tag count.');
  const expectedTags = Number.parseInt(tagCountMatch[1], 10);
  const tagChips = count(tagsHtml, /class="tag-chip"/g);
  if (tagChips !== expectedTags) {
    throw new Error(`Expected ${expectedTags} SSR tag links, found ${tagChips}.`);
  }
  if (tagsHtml.includes('lucide-tag')) {
    throw new Error('Tag directory must not render one SVG icon per tag.');
  }
}
