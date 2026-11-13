import { defineConfig } from 'vitest/config';
import { buildInfoPlugin } from './scripts/build-info.mjs';

export default defineConfig({
  plugins: [buildInfoPlugin()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
