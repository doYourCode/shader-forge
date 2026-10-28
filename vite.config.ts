import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * GitHub Pages project sites are served from /<repository>/, not from the
 * domain root. Without this base, Vite emits root-relative /assets/... URLs,
 * GitHub Pages answers with the 404 HTML page, and the browser refuses to
 * execute it as a module (the "text/html" MIME error).
 */
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName
    ? `/${repositoryName}/`
    : '/';

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
