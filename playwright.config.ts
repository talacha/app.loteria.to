import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const useDev = process.env.E2E_DEV === '1';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'on-first-retry' },
  // Chromium only; three form factors (PRD 3.10: phone first, then tablet and laptop).
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], locale: 'es-MX' } },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        locale: 'es-MX',
      },
    },
    {
      name: 'laptop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        locale: 'es-MX',
      },
    },
  ],
  webServer: {
    command: useDev
      ? `pnpm exec vite --port ${port} --strictPort`
      : `pnpm build && pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // Force LocalTransport (BroadcastChannel): blank every Supabase variable, including the
    // NEXT_PUBLIC_* fallbacks that vite.config.ts reads from .env.local.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    },
    timeout: 180_000,
  },
});
