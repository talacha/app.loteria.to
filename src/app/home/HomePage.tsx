import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LANGS, callableLangs, cardName, getCard, type Lang } from '@content';
import { LanguageSwitch, ThemeSwitch } from '../theme/Preferences';
import { applyStoredPrefs } from '../theme/prefs';
import page from '../theme/page.module.css';
import styles from './HomePage.module.css';
import { isValidRoomCode, normalizeRoomCode } from './joinCode';

applyStoredPrefs();

const SAMPLE_IDS = [
  'sol',
  'maiz',
  'colibri',
  'nopal',
  'luna',
  'llama',
  'frijol',
  'montana',
  'jaguar',
];
const CHIP_ORDER: Lang[] = ['nah', 'yua', 'quz', 'es', 'en'];

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const callable = callableLangs();
  const uiLang: Lang = i18n.language?.startsWith('en') ? 'en' : 'es';
  const chips = CHIP_ORDER.filter((l) => LANGS.includes(l));

  function join(e: FormEvent) {
    e.preventDefault();
    const c = normalizeRoomCode(code);
    if (!isValidRoomCode(c)) {
      setInvalid(true);
      return;
    }
    void navigate(`/r/${c}`);
  }

  return (
    <main className={page.page} id="main">
      <header className={styles.hero}>
        <div className={styles.topbar}>
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
        <h1 className={page.h1}>{t('app.name')}</h1>
        <p className={page.lead}>{t('home.tagline')}</p>
      </header>

      <section className={page.section} aria-labelledby="home-actions">
        <h2 className={page.h2} id="home-actions">
          {t('home.actions')}
        </h2>
        <div className={styles.actions}>
          <div className={`${page.panel} ${styles.action}`}>
            <Link to="/host" className={`${page.btn} ${page.btnPrimary}`}>
              {t('home.hostCta')}
            </Link>
            <p className={page.muted}>{t('home.hostHint')}</p>
          </div>
          <div className={`${page.panel} ${styles.action}`}>
            <Link to="/print" className={`${page.btn} ${page.btnPrimary}`}>
              {t('home.printCta')}
            </Link>
            <p className={page.muted}>{t('home.printHint')}</p>
          </div>
          <form className={`${page.panel} ${styles.join}`} onSubmit={join} noValidate>
            <label htmlFor="join-code">{t('home.joinLabel')}</label>
            <input
              id="join-code"
              className={page.input}
              value={code}
              maxLength={7}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-invalid={invalid}
              aria-describedby="join-help"
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setInvalid(false);
              }}
            />
            <p id="join-help" className={page.muted}>
              {t('home.joinHelp')}
            </p>
            {invalid && (
              <p role="alert" className={styles.error}>
                {t('home.joinInvalid')}
              </p>
            )}
            <button type="submit" className={`${page.btn} ${page.btnPrimary}`}>
              {t('home.joinSubmit')}
            </button>
          </form>
        </div>
      </section>

      <section className={page.section} aria-labelledby="home-langs">
        <h2 className={page.h2} id="home-langs">
          {t('home.languagesTitle')}
        </h2>
        <p className={page.muted}>{t('home.languagesIntro')}</p>
        <ul className={styles.chips}>
          {chips.map((l) => (
            <li key={l} className={styles.chip}>
              <span>{t(`lang.${l}`)}</span>
              <span className={page.badge}>
                {callable.includes(l) ? t('home.readyBadge') : t('home.pendingBadge')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={page.section} aria-labelledby="home-sample">
        <h2 className={page.h2} id="home-sample">
          {t('home.sampleTitle')}
        </h2>
        <ul className={styles.strip}>
          {SAMPLE_IDS.map((id) => {
            const card = getCard(id);
            if (!card) return null;
            return (
              <li key={id} className={styles.sample}>
                <span className={styles.emoji} aria-hidden="true">
                  {card.art}
                </span>
                <span>{cardName(card, uiLang)?.text ?? card.id}</span>
              </li>
            );
          })}
        </ul>
        <Link to="/deck">{t('home.sampleAll')}</Link>
      </section>

      <section className={page.section} aria-labelledby="home-how">
        <h2 className={page.h2} id="home-how">
          {t('home.howTitle')}
        </h2>
        <ol className={styles.steps}>
          {(['one', 'two', 'three'] as const).map((k) => (
            <li key={k}>
              <h3>{t(`home.steps.${k}.title`)}</h3>
              <p>{t(`home.steps.${k}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.cols}>
        <section className={page.section} aria-labelledby="home-incl">
          <h2 className={page.h2} id="home-incl">
            {t('home.inclusionTitle')}
          </h2>
          <ul className={styles.bullets}>
            {(['paper', 'access', 'private', 'offline'] as const).map((k) => (
              <li key={k}>{t(`home.inclusion.${k}`)}</li>
            ))}
          </ul>
        </section>
        <section className={page.section} aria-labelledby="home-aud">
          <h2 className={page.h2} id="home-aud">
            {t('home.audienceTitle')}
          </h2>
          <ul className={styles.bullets}>
            {(['classroom', 'family', 'heritage'] as const).map((k) => (
              <li key={k}>{t(`home.audience.${k}`)}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className={page.section} aria-labelledby="home-dev">
        <h2 className={page.h2} id="home-dev">
          {t('home.devTitle')}
        </h2>
        <p className={page.notice}>{t('home.devNotice')}</p>
      </section>

      <footer className={page.section}>
        <p>{t('home.privacyLine')}</p>
        <nav className={page.nav}>
          <Link to="/deck">{t('home.deckCta')}</Link>
          <Link to="/creditos">{t('home.creditsLink')}</Link>
        </nav>
      </footer>
    </main>
  );
}
