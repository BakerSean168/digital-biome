/**
 * Canonical labels used by the governance pilot are trimmed and lower-case.
 *
 * This intentionally small utility exists only on the disposable pilot branch so
 * Pixel's external-change repair loop can be verified without touching product
 * behavior on main.
 */
export function normalizeGovernancePilotLabel(value: string): string {
  return value.trim().toLowerCase();
}
