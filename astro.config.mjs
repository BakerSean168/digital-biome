// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

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
        '@vault': './vault/z',
        '@wiki': './src/content/wiki',
        '@components': './src/components',
      }
    }
  },
  
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    },
    remarkPlugins: [],
    rehypePlugins: []
  }
});
