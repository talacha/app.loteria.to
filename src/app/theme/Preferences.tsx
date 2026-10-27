import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './page.module.css';
import { getTheme, setTheme, setUiLang, type ThemePref, type UiLang } from './prefs';

const UI_LANGS: UiLang[] = ['es', 'en'];
const THEMES: ThemePref[] = ['auto', 'light', 'contrast'];

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'es';
  return (
    <div className={styles.row} role="group" aria-label={t('common.language')}>
      {UI_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={styles.btn}
          lang={l}
          aria-pressed={current === l}
          onClick={() => setUiLang(l)}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}

export function ThemeSwitch() {
  const { t } = useTranslation();
  const [theme, set] = useState<ThemePref>(getTheme);
  return (
    <div className={styles.row} role="group" aria-label={t('theme.label')}>
      {THEMES.map((v) => (
        <button
          key={v}
          type="button"
          className={styles.btn}
          aria-pressed={theme === v}
          onClick={() => {
            setTheme(v);
            set(v);
          }}
        >
          {t(`theme.${v}`)}
        </button>
      ))}
    </div>
  );
}
