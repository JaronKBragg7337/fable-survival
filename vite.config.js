// Vite config — kept minimal. base:'./' makes the build work on any
// static host (Vercel, Netlify, GitHub Pages subpaths) without changes.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
});
