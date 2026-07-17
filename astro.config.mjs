// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkNormalizeCodeLang from './src/utils/remark-normalize-code-lang.ts';
import remarkWikilinks from './src/utils/remark-wikilinks.ts';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: "zh",
    locales: ["zh"],
    routing: {
      prefixDefaultLocale: false
    }
  },

  site: process.env.PUBLIC_SITE_URL || 'https://bakersean.top/',

  outDir: './dist',
  publicDir: './public',

  integrations: [
    sitemap(),
  ],

  vite: {
    ssr: {
      external: ['svgo']
    },

    resolve: {
      alias: {
        '@components': './src/components',
      }
    },

    plugins: [tailwindcss()]
  },

  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
      langs: [],
    },
    remarkPlugins: [
      remarkNormalizeCodeLang,
      [remarkWikilinks, { notesRoot: './src/data/obsidian' }],
    ],
    rehypePlugins: []
  }
});
