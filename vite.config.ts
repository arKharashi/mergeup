import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works on GitHub Pages under /<repo>/.
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
