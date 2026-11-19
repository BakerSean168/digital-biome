/**
 * Extract category labels from tags.
 * Looks for `website/*` tags and resource-type tags.
 */
export function extractCategories(tags: string[], resourceTypes: string[]): string[] {
  const categories = new Set<string>();
  const normalizedResourceTypes = resourceTypes.map((r) => r.toLowerCase());

  for (const tag of tags) {
    const lower = tag.toLowerCase();

    if (lower.startsWith('website/')) {
      const parts = tag.replace(/^website\//i, '').split('/');
      categories.add(parts[parts.length - 1]);
    }

    if (normalizedResourceTypes.includes(lower)) {
      categories.add(lower);
    }
  }

  return Array.from(categories);
}
