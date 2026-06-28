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

/**
 * 格式化时间为“几小时前/几天前”
 */
export function formatTimeAgo(date: Date | string, lang: 'zh' | 'en' = 'zh'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    return lang === 'zh' ? `${interval} 年前` : `${interval} year${interval > 1 ? 's' : ''} ago`;
  }
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {
    return lang === 'zh' ? `${interval} 个月前` : `${interval} month${interval > 1 ? 's' : ''} ago`;
  }
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {
    return lang === 'zh' ? `${interval} 天前` : `${interval} day${interval > 1 ? 's' : ''} ago`;
  }
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return lang === 'zh' ? `${interval} 小时前` : `${interval} hour${interval > 1 ? 's' : ''} ago`;
  }
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return lang === 'zh' ? `${interval} 分钟前` : `${interval} minute${interval > 1 ? 's' : ''} ago`;
  }
  return lang === 'zh' ? '刚刚' : 'just now';
}
