import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

// Two projects (M5 W1-E):
// - `unit`: pure helpers (`*.spec.ts`), node environment (M1-DESIGN L13);
// - `dom`: React hooks / components (`*.test.tsx`), jsdom + Testing Library.
// `npm test` runs both; `npx vitest run --project dom` runs one.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          css: false,
        },
      },
    ],
  },
});
