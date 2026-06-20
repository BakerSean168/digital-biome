import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const optionalString = () => z.string().nullable().optional();
const optionalDate = () => z.union([z.string(), z.date()]).nullable().optional();
const optionalStringArray = () => z.array(z.string()).nullable().optional();
const optionalNumber = () => z.number().nullable().optional();
const optionalBooleanish = () => z.union([z.boolean(), z.string()]).nullable().optional();

/**
 * Notes 笔记集合（统一来源，包含所有 Obsidian 同步笔记）
 * 来源：src/content/notes/obsidian/（由 pnpm sync 从 thought-forest submodule 同步生成）
 * 使用 glob loader 精确锁定目录，避免与其他子目录产生 id 冲突
 */
const notes = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/data/obsidian',
    generateId: ({ entry }) => `obsidian/${entry.replace(/\.md$/, '')}`,
  }),
  schema: z.object({
    title: optionalString(),
    description: optionalString(),
    tags: optionalStringArray(),
    created: optionalDate(),
    updated: optionalDate(),
    draft: optionalBooleanish().default(false),
    private: optionalBooleanish().default(false),
    visibility: z.enum(['public', 'private', 'internal']).nullable().optional(),
    type: z.enum(['note', 'resource', 'tool', 'article']).nullable().optional().default('note'),
    url: optionalString(),
    icon: optionalString(),
    rating: optionalNumber(),
    platform: optionalString(),
    pricing: z.enum(['free', 'freemium', 'paid', 'subscription']).nullable().optional(),
    status: z.enum(['active', 'planned', 'archived', 'deprecated']).nullable().optional(),
    aliases: optionalStringArray(),
    category: optionalString(),
    asset_id: optionalString(),
    asset_type: z.enum(['service', 'tool', 'host', 'network']).nullable().optional(),
    asset_role: z.enum(['ops', 'product', 'showcase', 'portal']).nullable().optional(),
    host_asset_id: optionalString(),
    parent_asset_id: optionalString(),
    homepage: z.object({
      enabled: optionalBooleanish().default(true),
      section: z.enum(['services', 'projects', 'tools']).nullable().optional(),
      featured: optionalBooleanish().default(false),
      order: z.number().nullable().optional().default(100),
      label: optionalString(),
      description: optionalString(),
    }).nullable().optional(),
    monitor: z.object({
      provider: z.enum(['nezha', 'uptime-kuma', 'none']).nullable().optional(),
      url: optionalString(),
      target_id: optionalString(),
      label: optionalString(),
    }).nullable().optional(),
    links: z.array(z.object({
      label: z.string(),
      url: z.string(),
      kind: z.enum(['app', 'admin', 'repo', 'docs', 'monitor', 'panel', 'ssh', 'other']).default('other'),
      description: optionalString(),
      visibility: z.enum(['public', 'private', 'internal']).nullable().optional(),
    })).nullable().optional(),
  }).passthrough().transform(data => ({
    ...data,
    title: data.title ?? undefined,
    description: data.description ?? undefined,
    tags: data.tags ?? [],
    created: data.created ?? undefined,
    updated: data.updated ?? undefined,
    draft: data.draft === true || data.draft === 'true',
    private: data.private === true || data.private === 'true',
    visibility: data.visibility ?? undefined,
    type: data.type ?? 'note',
    url: data.url ?? undefined,
    icon: data.icon ?? undefined,
    rating: data.rating ?? undefined,
    platform: data.platform ?? undefined,
    pricing: data.pricing ?? undefined,
    status: data.status ?? undefined,
    aliases: data.aliases ?? [],
    category: data.category ?? undefined,
    asset_id: data.asset_id ?? undefined,
    asset_type: data.asset_type ?? undefined,
    asset_role: data.asset_role ?? undefined,
    host_asset_id: data.host_asset_id ?? undefined,
    parent_asset_id: data.parent_asset_id ?? undefined,
    homepage: data.homepage ? {
      enabled: data.homepage.enabled === undefined || data.homepage.enabled === null
        ? true
        : data.homepage.enabled === true || data.homepage.enabled === 'true',
      section: data.homepage.section ?? undefined,
      featured: data.homepage.featured === true || data.homepage.featured === 'true',
      order: data.homepage.order ?? 100,
      label: data.homepage.label ?? undefined,
      description: data.homepage.description ?? undefined,
    } : undefined,
    monitor: data.monitor ? {
      provider: data.monitor.provider ?? undefined,
      url: data.monitor.url ?? undefined,
      target_id: data.monitor.target_id ?? undefined,
      label: data.monitor.label ?? undefined,
    } : undefined,
    links: data.links ? data.links.map(link => ({
      label: link.label,
      url: link.url,
      kind: link.kind,
      description: link.description ?? undefined,
      visibility: link.visibility ?? undefined,
    })) : [],
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
