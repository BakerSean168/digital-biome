/**
 * 网站常量配置
 */

export const SITE_NAME = import.meta.env.PUBLIC_SITE_NAME || 'Digital Biome';
export const SITE_AUTHOR = import.meta.env.PUBLIC_SITE_AUTHOR || 'bakersean';
export const SITE_DESCRIPTION =
  import.meta.env.PUBLIC_SITE_DESCRIPTION || '个人知识生态网站 - 个人介绍、简历、学习笔记、工具箱';
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'https://bakersean.top';

const AUTHOR_EMAIL = import.meta.env.PUBLIC_AUTHOR_EMAIL || 'your-email@example.com';

// 社交链接
export const SOCIAL_LINKS = {
  github: import.meta.env.PUBLIC_GITHUB_URL || 'https://github.com/BakerSean168',
  linkedin: import.meta.env.PUBLIC_LINKEDIN_URL || 'https://linkedin.com',
  email: AUTHOR_EMAIL,
};
