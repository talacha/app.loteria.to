import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS, type Lang } from '@content';
import { Button, LanguageCard } from '../ui';
import { sampleWord } from '../lobby/langInfo';
import UiLangSwitch from './UiLangSwitch';
import styles from './PlayerBoard.module.css';

const ORDER: Lang[] = ['nah', 'yua', 'quz', 'es', 'en'];

export interface SettingsSheetProps {
  spokenLang: Lang;
  onSpokenLang: (l: Lang) => void;
  muted: boolean;
  onMuted: (m: boolean) => void;
  canShrink: boolean;
  canGrow: boolean;
  onSmaller: () => void;
  onLarger: () => void;
  contrast: boolean;
  onContrast: () => void;
  onClose: () => void;
}

/** Mid-game settings: spoken language, menu language, voice, text size, contrast. */
export default function SettingsSheet(p: SettingsSheetProps) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') p.onClose();
      }}
    >
      <div className={styles.sheetInner}>
        <h2 id="settings-title" className={styles.h2}>
          {t('player.settingsTitle')}
        </h2>

        <section className={styles.group}>
          <h3 className={styles.h3} id="spoken-h">
            {t('player.spokenLang')}
          </h3>
          <p className={styles.muted}>{t('player.spokenLangHint')}</p>
          <div role="radiogroup" aria-labelledby="spoken-h" className={styles.langList}>
            {ORDER.filter((l) => LANGS.includes(l)).map((l) => (
              <LanguageCard
                key={l}
                lang={l}
                name={t(`lobby.langs.${l}.name`)}
                native={t(`lobby.langs.${l}.native`)}
                sample={sampleWord(l)}
                selected={p.spokenLang === l}
                onSelect={() => p.onSpokenLang(l)}
              />
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h3 className={styles.h3}>{t('player.uiLang')}</h3>
          <UiLangSwitch />
        </section>

        <div className={styles.tools}>
          <button type="button" aria-pressed={p.muted} onClick={() => p.onMuted(!p.muted)}>
            {p.muted ? t('player.unmute') : t('player.mute')}
          </button>
          <button
            type="button"
            onClick={p.onSmaller}
            disabled={!p.canShrink}
            aria-label={t('player.textSmaller')}
          >
            A−
          </button>
          <button
            type="button"
            onClick={p.onLarger}
            disabled={!p.canGrow}
            aria-label={t('player.textLarger')}
          >
            A+
          </button>
          <button type="button" aria-pressed={p.contrast} onClick={p.onContrast}>
            {t('player.highContrast')}
          </button>
        </div>

        <Button autoFocus onClick={p.onClose}>
          {t('player.settingsClose')}
        </Button>
      </div>
    </div>
  );
}
