import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { aliases } from './vite.aliases.ts';
import tokens from './design/tokens.json' with { type: 'json' };

// The Vercel Supabase integration injects NEXT_PUBLIC_SUPABASE_*; expose only the
// public URL and anon key to the client under the VITE_ names src/net reads.
// Setting process.env before Vite resolves env makes them part of import.meta.env.
function mapSupabasePublicEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_SUPABASE_']);
  process.env.VITE_SUPABASE_URL ||= env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  process.env.VITE_SUPABASE_ANON_KEY ||=
    env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

export default defineConfig(({ mode }) => {
  mapSupabasePublicEnv(mode);
  return config;
});

const config = {
  resolve: { alias: aliases },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lotería de los Pueblos',
        short_name: 'Lotería',
        description:
          'Lotería de imágenes para jugar en familia. Las voces cantan las cartas en cinco idiomas. Gratis, sin cuentas.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: tokens.color.night.$value,
        theme_color: tokens.color.maiz.$value,
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache shell, content, art and audio (budget: < 10 MB total).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,json,webm,m4a,woff2,ttf}'],
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
} satisfies UserConfig;
