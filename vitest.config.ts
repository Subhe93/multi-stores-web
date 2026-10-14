import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Minimal unit-test setup for pure helpers (M1-DESIGN L13). Only `*.spec.ts`
// files under src are picked up; React components and Next routes stay out.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
