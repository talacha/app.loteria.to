import { useTranslation } from 'react-i18next';
import { setUiLang } from '../theme/prefs';
import type { UiLang } from './profile';
import styles from './UiLangSwitch.module.css';

/** Small ES | EN switch for the menu language. Independent of the spoken language. */
export default function UiLangSwitch() {
  const { t, i18n } = useTranslation();
  const current: UiLang = i18n.language?.startsWith('en') ? 'en' : 'es';
  const set = (l: UiLang) => {
    setUiLang(l);
  };
  return (
    <div className={styles.switch} role="group" aria-label={t('player.uiLang')}>
      {(['es', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          className={styles.opt}
          aria-pressed={current === l}
          lang={l}
          aria-label={`${l.toUpperCase()} · ${t(l === 'es' ? 'player.uiLangEs' : 'player.uiLangEn')}`}
          onClick={() => set(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
