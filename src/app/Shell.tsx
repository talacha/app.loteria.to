import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ThemeSwitch } from './theme/Preferences';
import { applyStoredPrefs } from './theme/prefs';
import { LanguageSettings, Sheet } from './ui';
import styles from './Shell.module.css';

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
  const [sheet, setSheet] = useState<'theme' | 'settings' | null>(null);

  // Apply the stored theme and language on mount (index.html may also do it before first paint).
  useEffect(() => {
    applyStoredPrefs();
  }, []);

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
      <header className={styles.bar}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('theme.settings.themeOpen')}
          aria-haspopup="dialog"
          onClick={() => setSheet('theme')}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18" />
            <path d="M12 3a9 9 0 010 18z" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('theme.settings.open')}
          aria-haspopup="dialog"
          onClick={() => setSheet('settings')}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
          </svg>
        </button>
      </header>
      <Outlet />
      <Sheet
        title={t('theme.settings.themeTitle')}
        open={sheet === 'theme'}
        onClose={() => setSheet(null)}
      >
        <ThemeSwitch />
      </Sheet>
      <Sheet
        title={t('theme.settings.title')}
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
      >
        <LanguageSettings />
      </Sheet>
    </>
  );
}
