import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // three.js alone is ~550 KB minified; it loads after the text, in its own chunk.
    chunkSizeWarningLimit: 900,
  },
});
