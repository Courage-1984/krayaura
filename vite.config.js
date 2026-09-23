import { defineConfig } from 'vite';
import { resolve } from 'path';

// GitHub Pages project site: https://Courage-1984.github.io/krayaura/
export default defineConfig({
  base: '/krayaura/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
