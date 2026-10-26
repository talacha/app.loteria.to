import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { aliases } from './vite.aliases.ts';

export default defineConfig({
  resolve: { alias: aliases },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Lotería de los Pueblos',
        short_name: 'Lotería',
        description: 'Lotería in five languages. Play with phones or paper.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff8ec',
        theme_color: '#b3261e',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Precache shell, content, art and audio (budget: < 10 MB total).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,json,webm,m4a,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: { sourcemap: true },
});
