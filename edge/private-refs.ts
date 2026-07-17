/**
 * Shared private_ref key construction for asset links.
 * Used by merge-asset-index (build) and private infrastructure export.
 */

export interface ProtectableLink {
  label: string;
  url?: string;
  kind?: string;
  visibility?: "public" | "private" | "internal" | string | null;
}

export function toPrivateKeyPart(value: string, fallback: string): string {
  const keyPart = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return keyPart || fallback;
}

export function isProtectedLinkVisibility(visibility?: string | null): boolean {
  return visibility === "internal" || visibility === "private";
}

/**
 * Build stable private_ref keys for protected links.
 * Duplicate kinds get a label suffix; further collisions get -2, -3, ...
 */
export function buildPrivateLinkRefs(
  assetId: string,
  links: ProtectableLink[],
): Array<{ link: ProtectableLink; privateRef: string | null }> {
  const protectedKindCounts = new Map<string, number>();
  for (const link of links) {
    if (isProtectedLinkVisibility(link.visibility)) {
      const kind = toPrivateKeyPart(link.kind || "other", "other");
      protectedKindCounts.set(kind, (protectedKindCounts.get(kind) || 0) + 1);
    }
  }

  const usedRefs = new Map<string, number>();
  return links.map((link) => {
    if (!isProtectedLinkVisibility(link.visibility)) {
      return { link, privateRef: null };
    }

    const kind = toPrivateKeyPart(link.kind || "other", "other");
    const labelSuffix = (protectedKindCounts.get(kind) || 0) > 1
      ? `.${toPrivateKeyPart(link.label, "link")}`
      : "";
    const baseRef = `${assetId}.links.${kind}${labelSuffix}`;
    const duplicateCount = usedRefs.get(baseRef) || 0;
    usedRefs.set(baseRef, duplicateCount + 1);
    const privateRef = duplicateCount === 0 ? baseRef : `${baseRef}-${duplicateCount + 1}`;
    return { link, privateRef };
  });
}

export function redactProtectedLinks(
  assetId: string,
  links: ProtectableLink[],
): Record<string, unknown>[] {
  return buildPrivateLinkRefs(assetId, links).map(({ link, privateRef }) => {
    if (!privateRef) {
      return { ...link };
    }
    const { url: _privateUrl, ...publicMetadata } = link;
    return {
      ...publicMetadata,
      private_ref: privateRef,
    };
  });
}
