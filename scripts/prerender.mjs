// Post-build prerender: renders each public route to static HTML (react-dom/server, no browser, so it
// runs on Vercel's build image), applies the per-route head, writes the app shell (dist/app.html),
// the 404 page and sitemap.xml.
// Usage: node scripts/prerender.mjs   (after `vite build`; wired into `pnpm build`)
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aliases } from '../vite.aliases.ts';

// Node 26 exposes a global localStorage that warns on access without --localstorage-file; the app's
// storage reads are try/catch-guarded, so SSR just sees it as unavailable.
Object.defineProperty(globalThis, 'localStorage', {
  value: undefined,
  configurable: true,
  writable: true,
});

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const ssrOut = join(root, 'node_modules/.cache/prerender-ssr');
const SITE = 'https://app.loteria.to';
const ROUTES = ['/', '/deck', '/creditos', '/solo', '/print'];
const NOT_FOUND_PROBE = '/__no-such-page__';

if (!existsSync(join(dist, 'index.html')))
  throw new Error('dist/index.html missing: run vite build first');

// 1. App shell for private routes (/host, /r/*, /ui): the built index.html, noindexed and without
//    the home page's canonical/OG identity. The invite middleware fetches this file too.
const built = readFileSync(join(dist, 'index.html'), 'utf8');
const shellPath = join(dist, 'app.html');
if (!/data-route=/.test(built) || !existsSync(shellPath)) {
  writeFileSync(
    shellPath,
    built
      .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow" />')
      .replace(/<link rel="(?:canonical|alternate)"[^>]*>\s*/g, '')
      .replace(/<meta property="og:url"[^>]*>\s*/g, ''),
  );
}
const template = readFileSync(shellPath, 'utf8');

// 2. Bundle the SSR entry (same CSS-modules hashing as the client build).
rmSync(ssrOut, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  resolve: { alias: aliases },
  ssr: { noExternal: [/^(?!react$|react-dom|react-router|i18next|react-i18next).*/] },
  build: {
    ssr: join(root, 'src/app/seo/ssr-entry.tsx'),
    outDir: ssrOut,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { output: { entryFileNames: 'ssr-entry.mjs' } },
  },
});
const entry = await import(pathToFileURL(join(ssrOut, 'ssr-entry.mjs')).href);

// 3. Render each route into the template.
async function snapshot(path) {
  const { body, title, faq } = await entry.renderRoute(path);
  const dom = new JSDOM(template);
  const { window } = dom;
  globalThis.document = window.document;
  window.document.getElementById('root').innerHTML = body;
  window.document.getElementById('root').dataset.route =
    path === NOT_FOUND_PROBE ? '__404__' : path;
  entry.applyHead(path, 'es', title, faq);
  return '<!doctype html>\n' + window.document.documentElement.outerHTML;
}

const out = new Map();
for (const r of [...ROUTES, NOT_FOUND_PROBE]) out.set(r, await snapshot(r));
delete globalThis.document;

for (const [route, html] of out) {
  const file =
    route === NOT_FOUND_PROBE
      ? join(dist, '404.html')
      : route === '/'
        ? join(dist, 'index.html')
        : join(dist, route.slice(1), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(
    `prerendered ${route === NOT_FOUND_PROBE ? '404' : route} -> ${file.replace(root, '')} (${html.length} bytes)`,
  );
}
rmSync(ssrOut, { recursive: true, force: true });

// 4. sitemap.xml
let lastmod;
try {
  lastmod = execSync('git log -1 --format=%cs', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  /* not a git checkout (Vercel builds may lack history) */
}
lastmod ||= new Date().toISOString().slice(0, 10);
const urls = ROUTES.map(
  (r) =>
    `  <url>\n    <loc>${SITE}${r}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${r === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${r === '/' ? '1.0' : '0.6'}</priority>\n  </url>`,
).join('\n');
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
console.log('wrote dist/sitemap.xml');
