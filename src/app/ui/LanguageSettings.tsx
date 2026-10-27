import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cardName, getCard, type Lang } from '@content';
import { speakCall } from '../audio';
import { setUiLang } from '../theme/prefs';
import { LanguageCard } from './game';
import { SPOKEN_LANGS, useProfile, type UiLang } from './profile';
import styles from './ui.module.css';

const UI_LANGS: UiLang[] = ['es', 'en'];

/**
 * Two separate pickers: the language of the app (buttons, text) and the language you hear
 * (the cantor's call). Both persist in localStorage 'loteria:profile'.
 */
export default function LanguageSettings() {
  const { t } = useTranslation();
  const { uiLang, spokenLang, availableSpokenLangs, update } = useProfile();
  const [note, setNote] = useState('');
  const sun = getCard('sol');

  async function play(lang: Lang) {
    setNote('');
    const res = await speakCall(sun!, lang);
    if (res === 'no-audio') setNote(`${t('lang.' + lang)}: ${t('theme.settings.noAudio')}`);
  }

  return (
    <div className={styles.settings}>
      <fieldset className={styles.settingsGroup}>
        <legend className={styles.settingsLegend}>{t('theme.settings.uiTitle')}</legend>
        <p className={styles.settingsHelp}>{t('theme.settings.uiHelp')}</p>
        <div
          className={styles.settingsList}
          role="radiogroup"
          aria-label={t('theme.settings.uiTitle')}
        >
          {UI_LANGS.map((l) => (
            <LanguageCard
              key={l}
              lang={l}
              name={t(`lang.${l}`)}
              selected={uiLang === l}
              onSelect={() => setUiLang(l)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.settingsGroup}>
        <legend className={styles.settingsLegend}>{t('theme.settings.spokenTitle')}</legend>
        <p className={styles.settingsHelp}>{t('theme.settings.spokenHelp')}</p>
        <div
          className={styles.settingsList}
          role="radiogroup"
          aria-label={t('theme.settings.spokenTitle')}
        >
          {SPOKEN_LANGS.map((l) => {
            const word = sun ? (cardName(sun, l)?.text ?? '') : '';
            return (
              <div key={l} className={styles.langRow}>
                <LanguageCard
                  lang={l}
                  name={t(`lang.${l}`)}
                  sample={word || undefined}
                  selected={spokenLang === l}
                  disabled={!availableSpokenLangs.includes(l)}
                  onSelect={() => update({ spokenLang: l })}
                />
                {!availableSpokenLangs.includes(l) ? <p>{t('player.languageNotInRound')}</p> : null}
                {word && (
                  <button
                    type="button"
                    className={styles.playBtn}
                    aria-label={t('theme.settings.play', { word, lang: t(`lang.${l}`) })}
                    onClick={() => void play(l)}
                  >
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 9v6h4l5 4V5L9 9H5z" />
                      <path d="M18 9a4 4 0 010 6" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className={styles.settingsNote} role="status">
          {note}
        </p>
      </fieldset>
    </div>
  );
}
