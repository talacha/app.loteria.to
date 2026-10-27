import { defineConfig } from 'vitest/config';
import { aliases } from './vite.aliases.ts';

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias: aliases },
        test: {
          name: 'engine',
          environment: 'node',
          include: [
            'src/engine/**/*.test.ts',
            'src/content/**/*.test.ts',
            'src/net/**/*.test.ts',
            'src/ai/**/*.test.ts',
            'scripts/**/*.test.ts',
            'tests/api/**/*.test.ts',
          ],
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/app/**/*.test.{ts,tsx}', 'src/print/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
});
