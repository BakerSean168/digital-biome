export function stripMarkupToText(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}
