// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import remarkNormalizeCodeLang from './src/utils/remark-normalize-code-lang.ts';
import remarkWikilinks from './src/utils/remark-wikilinks.ts';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  adapter: netlify(),

  site: process.env.PUBLIC_SITE_URL || 'https://digital-biome.netlify.app/',

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
      [remarkWikilinks, { hrefTemplate: (/** @type {string} */ slug) => `/notes/obsidian/${slug}` }],
    ],
    rehypePlugins: []
  }
});