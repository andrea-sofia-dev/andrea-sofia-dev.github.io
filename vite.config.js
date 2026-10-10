import { defineConfig } from 'vite';
import { moreProjects } from './scripts/more-projects.js';

export default defineConfig({
  plugins: [moreProjects()],
  build: {
    target: 'es2022',
    // three.js alone is ~550 KB minified; it loads after the text, in its own chunk.
    chunkSizeWarningLimit: 900,
  },
});
