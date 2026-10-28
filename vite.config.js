import { defineConfig } from 'vite';
import { resolve } from 'path';
import { siteFromEnv } from './scripts/site.mjs';

const site = siteFromEnv();

export default defineConfig(({ command }) => ({
  base: site.base,
  root: '.',
  publicDir: 'public',
  build: {
    outDir: site.outDir,
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: 'krayaura-site',
      // Pre so OG https:// URLs exist before Vite treats tokens as relative.
      // Dev's HTML rewriter posix.joins config.base onto every `/…` src — stamp
      // `/` here and let Vite add `/krayaura/`. Build stamps site.base itself.
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const assetBase = command === 'build' ? site.base : '/';
          html = html.replaceAll('__SITE_URL__', site.url);
          html = html.replaceAll('__BASE__', assetBase);
          if (site.noindex) {
            html = html.replace(
              '<meta name="theme-color" content="#0B0B21" />',
              '<meta name="theme-color" content="#0B0B21" />\n    <meta name="robots" content="noindex, nofollow" />',
            );
          }
          return html;
        },
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
}));
