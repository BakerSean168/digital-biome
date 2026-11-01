// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkNormalizeCodeLang from './src/utils/remark-normalize-code-lang.ts';
import remarkWikilinks from './src/utils/remark-wikilinks.ts';
import rehypeStableHeadingIds from './src/utils/rehype-stable-heading-ids.ts';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  site: process.env.PUBLIC_SITE_URL || 'https://bakersean.top/',

  // Astro 7 defaults to JSX whitespace rules; keep HTML-aware compression so inline
  // text spacing (CJK/Latin mixes, inline links and badges) renders as before.
  compressHTML: true,

  outDir: './dist',
  publicDir: './public',

  integrations: [sitemap()],

  server: {
    allowedHosts: process.env.BIOME_PREVIEW_HOST ? [process.env.BIOME_PREVIEW_HOST] : [],
  },

  vite: {
    ssr: {
      external: ['svgo'],
    },

    resolve: {
      alias: {
        '@components': './src/components',
      },
    },

    plugins: [tailwindcss()],
  },

  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
      langs: [],
    },
    // Keep the unified (remark/rehype) pipeline: Wikilinks, code-language normalisation
    // and stable heading IDs are unified plugins (Astro 7 defaults to Satteri).
    processor: unified({
      remarkPlugins: [
        remarkNormalizeCodeLang,
        [remarkWikilinks, { notesRoot: './src/data/obsidian' }],
      ],
      rehypePlugins: [rehypeStableHeadingIds],
    }),
  },
});
