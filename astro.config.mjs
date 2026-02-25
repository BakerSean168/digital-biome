// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import remarkNormalizeCodeLang from './src/utils/remark-normalize-code-lang.ts';
import remarkWikilinks from './src/utils/remark-wikilinks.ts';

// https://astro.build/config
export default defineConfig({
  adapter: netlify(),

  site: 'https://digital-biome.netlify.app/',

  outDir: './dist',
  publicDir: './public',

  vite: {
    ssr: {
      external: ['svgo']
    },
    resolve: {
      alias: {
        '@components': './src/components',
      }
    }
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
      [remarkWikilinks, { hrefTemplate: (slug) => `/notes/obsidian/${slug}` }],
    ],
    rehypePlugins: []
  }
});
