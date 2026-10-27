import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

/** Catalog key (in ns `ui`) for the page title of a route. */
export function titleKey(pathname: string): string {
  if (pathname === '/') return 'home.title';
  if (pathname.startsWith('/host')) return 'host.title';
  if (pathname.startsWith('/r/')) return 'join.title';
  if (pathname.startsWith('/print')) return 'print.title';
  if (pathname.startsWith('/deck')) return 'deck.title';
  if (pathname.startsWith('/creditos')) return 'credits.title';
  return 'app.name';
}

function focusMain(): void {
  const main = document.getElementById('main');
  if (!main) return;
  main.tabIndex = -1;
  main.focus({ preventScroll: false });
}

export default function Shell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    const page = t(titleKey(pathname));
    document.title = pathname === '/' ? page : `${page} · ${t('app.name')}`;
  }, [pathname, t]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    focusMain();
  }, [pathname]);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          focusMain();
        }}
      >
        {t('common.skipToContent')}
      </a>
      <Outlet />
    </>
  );
}
