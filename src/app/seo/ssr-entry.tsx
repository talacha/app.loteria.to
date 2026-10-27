// Build-time entry for scripts/prerender.mjs (bundled with `vite build --ssr`, never shipped).
// Renders a route to static markup and exposes the head helper so the script can apply it to a
// DOM-less template with jsdom.
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import i18n from '../i18n';
import Shell from '../Shell';
import { titleKey } from '../titleKey';
import { routes } from '../routes';
import { FAQ_KEYS } from './meta';

export { applyHead } from './head';

const handler = createStaticHandler([{ element: <Shell />, children: routes }]);

export async function renderRoute(path: string): Promise<{
  body: string;
  title: string;
  faq: { q: string; a: string }[];
}> {
  await i18n.changeLanguage('es');
  const context = await handler.query(new Request(`https://app.loteria.to${path}`));
  if (context instanceof Response) throw new Error(`unexpected redirect for ${path}`);
  const router = createStaticRouter(handler.dataRoutes, context);
  const body = renderToString(
    <StaticRouterProvider router={router} context={context} hydrate={false} />,
  );
  const t = i18n.t.bind(i18n);
  const page = t(titleKey(path));
  const title = path === '/' || page === t('app.name') ? page : `${page} · ${t('app.name')}`;
  const faq = FAQ_KEYS.map((k) => ({
    q: t(`home.faq.items.${k}.q`),
    a: t(`home.faq.items.${k}.a`),
  }));
  return { body, title, faq };
}
