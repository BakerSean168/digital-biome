/**
 * 工具函数集合
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  tags: string[];
  [key: string]: any;
}

/**
 * 获取文章 URL
 */
export function getBlogPostUrl(slug: string): string {
  return `/blog/${slug}`;
}

/**
 * 按日期排序博客文章
 */
export function sortPostsByDate(posts: BlogPost[]): BlogPost[] {
  return posts.sort((a, b) => {
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
}

/**
 * 按标签过滤文章
 */
export function filterPostsByTag(posts: BlogPost[], tag: string): BlogPost[] {
  return posts.filter(post => post.tags?.includes(tag));
}

/**
 * 获取所有唯一标签
 */
export function getAllTags(posts: BlogPost[]): string[] {
  const tags = new Set<string>();
  posts.forEach(post => {
    post.tags?.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}
