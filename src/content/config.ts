import { defineCollection, z } from 'astro:content';

/**
 * 博客内容集合
 * 存储位置: src/content/blog/
 */
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

/**
 * Wiki 知识库集合
 * 支持两种来源：
 * 1. src/content/wiki/        - 本地笔记
 * 2. vault/z/                 - Git submodule（Obsidian vault）
 */
const wiki = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    created: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    private: z.boolean().default(false),
    
    type: z.enum(['note', 'resource', 'tool', 'article']).default('note'),
    url: z.string().url().optional(),
    icon: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    platform: z.string().optional(),
    pricing: z.enum(['free', 'freemium', 'paid', 'subscription']).optional(),
    status: z.enum(['active', 'archived', 'deprecated']).optional(),
    
    aliases: z.array(z.string()).default([]),
    category: z.string().optional(),
  }).passthrough(),
});

/**
 * 书签/导航集合 (Dashboard 数据源)
 * 存储位置: src/content/bookmarks/
 * 使用 YAML 文件存储分组书签
 */
const bookmarks = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    icon: z.string().optional(),
    order: z.number().default(0),
    links: z.array(z.object({
      name: z.string(),
      url: z.string().url(),
      icon: z.string().optional(),
      description: z.string().optional(),
    })),
  }),
});

/**
 * 个人资料/简历数据
 * 存储位置: src/content/meta/
 */
const meta = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    title: z.string(),
    bio: z.string().optional(),
    avatar: z.string().optional(),
    contact: z.object({
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
    }).optional(),
    experience: z.array(z.object({
      role: z.string(),
      company: z.string(),
      period: z.string(),
      description: z.string().optional(),
      highlights: z.array(z.string()).default([]),
    })).default([]),
    education: z.array(z.object({
      degree: z.string(),
      school: z.string(),
      period: z.string(),
      major: z.string().optional(),
    })).default([]),
    skills: z.record(z.array(z.string())).default({}),
    projects: z.array(z.object({
      name: z.string(),
      tech: z.string().optional(),
      description: z.string(),
      url: z.string().optional(),
    })).default([]),
  }),
});

export const collections = { blog, wiki, bookmarks, meta };
