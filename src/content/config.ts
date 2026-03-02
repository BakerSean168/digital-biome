import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Notes 笔记集合（统一来源，包含所有 Obsidian 同步笔记）
 * 来源：src/content/notes/obsidian/（由 pnpm sync 从 thought-forest submodule 同步生成）
 * 使用 glob loader 精确锁定目录，避免与其他子目录产生 id 冲突
 */
const notes = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/notes/obsidian',
    generateId: ({ entry }) => `obsidian/${entry.replace(/\.md$/, '')}`,
  }),
  schema: z.record(z.unknown()).transform(data => ({
    title: (data as any).title,
    description: (data as any).description,
    tags: (data as any).tags || [],
    created: (data as any).created,
    updated: (data as any).updated,
    draft: (data as any).draft || false,
    private: (data as any).private || false,
    type: (data as any).type || 'note',
    url: (data as any).url,
    icon: (data as any).icon,
    rating: (data as any).rating,
    platform: (data as any).platform,
    pricing: (data as any).pricing,
    status: (data as any).status,
    aliases: (data as any).aliases || [],
    category: (data as any).category,
  })),
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

export const collections = { notes, meta };
