/**
 * 网站常量配置
 */

export const SITE_NAME = import.meta.env.PUBLIC_SITE_NAME || 'Digital Biome';
export const SITE_AUTHOR = import.meta.env.PUBLIC_SITE_AUTHOR || '你的名字';
export const SITE_DESCRIPTION = import.meta.env.PUBLIC_SITE_DESCRIPTION || '个人知识生态网站 - 个人介绍、简历、学习笔记、工具箱';
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'https://yourdomain.com';

// 个人信息
export const AUTHOR_NAME = import.meta.env.PUBLIC_AUTHOR_NAME || SITE_AUTHOR;
export const AUTHOR_EMAIL = import.meta.env.PUBLIC_AUTHOR_EMAIL || 'your-email@example.com';
export const AUTHOR_PHONE = import.meta.env.PUBLIC_AUTHOR_PHONE || '+86 138****8888';
export const AUTHOR_LOCATION = import.meta.env.PUBLIC_AUTHOR_LOCATION || 'City, Country';

// 社交链接
export const SOCIAL_LINKS = {
  github: import.meta.env.PUBLIC_GITHUB_URL || 'https://github.com',
  twitter: import.meta.env.PUBLIC_TWITTER_URL || 'https://twitter.com',
  linkedin: import.meta.env.PUBLIC_LINKEDIN_URL || 'https://linkedin.com',
  email: AUTHOR_EMAIL
};

// 博客配置
export const BLOG_CONFIG = {
  postsPerPage: 10,
  tagsPerPage: 20
};
