/** Editorial blog archive month: retrospective grouping, never an authorship timestamp. */
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function archiveMonthTimestamp(value: string | null | undefined): number | null {
  const match = value?.match(MONTH_PATTERN);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
}

export function formatArchiveMonth(value: string | null | undefined): string | undefined {
  const match = value?.match(MONTH_PATTERN);
  if (!match) return undefined;
  return `专题归档 · ${match[1]} 年 ${Number(match[2])} 月`;
}
