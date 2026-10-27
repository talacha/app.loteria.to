import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ThemeSwitch } from './theme/Preferences';
import { applyStoredPrefs } from './theme/prefs';
import { LanguageSettings, Sheet } from './ui';
import { FAQ_KEYS, applyHead } from './seo';
import { titleKey } from './titleKey';
import styles from './Shell.module.css';

function focusMain(): void {
  const main = document.getElementById('main');
  if (!main) return;
  main.tabIndex = -1;
  main.focus({ preventScroll: false });
}

export default function Shell() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const first = useRef(true);
  const [sheet, setSheet] = useState<'theme' | 'settings' | null>(null);

  // Apply the stored theme and language on mount (index.html may also do it before first paint).
  useEffect(() => {
    applyStoredPrefs();
  }, []);

  useEffect(() => {
    const page = t(titleKey(pathname));
    const faq = FAQ_KEYS.map((k) => ({
      q: t(`home.faq.items.${k}.q`),
      a: t(`home.faq.items.${k}.a`),
    }));
    applyHead(
      pathname,
      i18n.language?.startsWith('en') ? 'en' : 'es',
      pathname === '/' ? page : `${page} · ${t('app.name')}`,
      faq,
    );
  }, [pathname, t, i18n.language]);

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
        {pathname !== '/' && (
          <Link className={styles.brand} to="/" aria-label={t('app.name')}>
            <img src="/brand/loteria-banner.webp" alt="" width="1200" height="403" />
          </Link>
        )}
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
          aria-label={t('theme.kit.gear.label')}
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
            <polygon points="19.69,9.79 21.90,10.61 21.90,13.39 19.69,14.21 19.00,15.88 19.99,18.02 18.02,19.99 15.88,19.00 14.21,19.69 13.39,21.90 10.61,21.90 9.79,19.69 8.12,19.00 5.98,19.99 4.01,18.02 5.00,15.88 4.31,14.21 2.10,13.39 2.10,10.61 4.31,9.79 5.00,8.12 4.01,5.98 5.98,4.01 8.12,5.00 9.79,4.31 10.61,2.10 13.39,2.10 14.21,4.31 15.88,5.00 18.02,4.01 19.99,5.98 19.00,8.12" />
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
