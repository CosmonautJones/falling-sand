import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { buildInfoPlugin } from './scripts/build-info.mjs';

export default defineConfig({
  plugins: [buildInfoPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        classic: fileURLToPath(new URL('./classic.html', import.meta.url)),
      },
    },
  },
});
