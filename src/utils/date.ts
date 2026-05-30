/**
 * 格式化日期
 */
export function formatDate(date: Date | string, locale: string = 'zh-CN'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 获取文章阅读时间 (估算)
 */
export function getReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const trimmed = content.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}
