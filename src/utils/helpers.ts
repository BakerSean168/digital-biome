/**
 * 工具函数集合
 */

/**
 * 格式化日期为相对时间（中文）
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - d.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays}天前`;
  if (diffDays < 365) return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

/**
 * 获取笔记页面 URL
 */
export function getNoteUrl(slug: string): string {
  return `/notes/${slug}`;
}
