import { useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LANGS, callableLangs, cardName, getCard, type Lang } from '@content';
import { applyStoredPrefs } from '../theme/prefs';
import { Button, CardArt, LanguageSettings } from '../ui';
import page from '../theme/page.module.css';
import styles from './HomePage.module.css';
import { FAQ_KEYS } from '../seo/meta';
import { isValidRoomCode, normalizeRoomCode } from './joinCode';
import { NAME_MAX, readProfile, saveProfile } from './profile';

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
/** Non-human glyphs; the stored value is the card's emoji, which the join page understands. */
const GLYPH_IDS = ['jaguar', 'rana', 'mariposa', 'tortuga', 'nopal', 'luna'];
const CHIP_ORDER: Lang[] = ['nah', 'yua', 'quz', 'es', 'en'];

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [saved] = useState(readProfile);
  const glyphs = GLYPH_IDS.flatMap((id) => {
    const card = getCard(id);
    return card ? [card] : [];
  });
  const [name, setName] = useState(saved.name ?? '');
  const [glyph, setGlyph] = useState(
    glyphs.find((c) => c.art === saved.glyph)?.art ?? glyphs[0]?.art ?? '',
  );
  const [nameMissing, setNameMissing] = useState(false);
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [scanHelp, setScanHelp] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const callable = callableLangs();
  const uiLang: Lang = i18n.language?.startsWith('en') ? 'en' : 'es';
  const chips = CHIP_ORDER.filter((l) => LANGS.includes(l));

  function persist(nextName = name, nextGlyph = glyph) {
    saveProfile({ name: nextName.trim().slice(0, NAME_MAX), glyph: nextGlyph });
  }

  function create(e: MouseEvent) {
    if (!name.trim()) {
      e.preventDefault();
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    persist();
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const c = normalizeRoomCode(code);
    if (!isValidRoomCode(c)) {
      setInvalid(true);
      return;
    }
    persist();
    void navigate(`/r/${c}`);
  }

  return (
    <main className={page.page} id="main">
      <div className={styles.layout}>
        <div className={styles.setup}>
          <div className={styles.top}>
            <div className={styles.logo}>
              <img
                src="/brand/loteria-banner.webp"
                alt={t('app.name')}
                width="1200"
                height="403"
                fetchPriority="high"
              />
            </div>
          </div>

          <h1 className={styles.product}>{t('home.h1')}</h1>
          <p className={styles.lede}>{t('home.lede')}</p>

          <h2 className={styles.title}>{t('home.nameTitle')}</h2>

          <div className={styles.field}>
            <label htmlFor="home-name">{t('home.nameLabel')}</label>
            <input
              id="home-name"
              ref={nameRef}
              className={styles.name}
              type="text"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="nickname"
              aria-invalid={nameMissing}
              aria-describedby="home-name-hint"
              onChange={(e) => {
                setName(e.target.value);
                setNameMissing(false);
                persist(e.target.value, glyph);
              }}
            />
            <p id="home-name-hint" className={styles.hint}>
              {t('home.nameHint')}
            </p>
            {nameMissing && (
              <p role="alert" className={styles.error}>
                {t('home.nameRequired')}
              </p>
            )}
          </div>

          <fieldset className={`${styles.field} ${styles.glyphSet}`}>
            <legend>{t('home.glyphLegend')}</legend>
            <div className={styles.glyphs} role="radiogroup" aria-label={t('home.glyphGroup')}>
              {glyphs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  className={styles.glyph}
                  aria-checked={glyph === c.art}
                  aria-label={cardName(c, uiLang)?.text ?? c.id}
                  onClick={() => {
                    setGlyph(c.art);
                    persist(name, c.art);
                  }}
                >
                  <CardArt id={c.id} emoji={c.art} emojiClassName={styles.glyphEmoji} />
                </button>
              ))}
            </div>
          </fieldset>

          <LanguageSettings />

          <div className={styles.actions}>
            <Button to="/host" className={styles.create} onClick={create}>
              <strong>{t('home.createCta')}</strong>
              <span>{t('home.createHint')}</span>
            </Button>

            <Button to="/solo" variant="secondary">
              {t('solo.cta')}
            </Button>

            <div className={styles.divider} aria-hidden="true">
              {t('home.or')}
            </div>

            <form className={styles.join} onSubmit={join} noValidate>
              <label htmlFor="join-code" style={{ fontWeight: 700 }}>
                {t('home.joinTitle')}
              </label>
              <div className={styles.joinRow}>
                <input
                  id="join-code"
                  className={styles.code}
                  value={code}
                  maxLength={7}
                  placeholder={t('home.codePlaceholder')}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={invalid}
                  aria-describedby="join-help"
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setInvalid(false);
                  }}
                />
                <Button type="submit" variant="secondary" fit className={styles.enter}>
                  {t('home.enter')}
                </Button>
              </div>
              <p id="join-help" className={styles.hint}>
                {t('home.joinHelp')}
              </p>
              {invalid && (
                <p role="alert" className={styles.error}>
                  {t('home.joinInvalid')}
                </p>
              )}
              <button
                type="button"
                className={styles.scan}
                aria-expanded={scanHelp}
                aria-controls="scan-help"
                onClick={() => setScanHelp((v) => !v)}
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
                  <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" />
                  <path d="M8 12h8" />
                </svg>
                {t('home.scanCta')}
              </button>
              {scanHelp && (
                <p id="scan-help" className={styles.hint}>
                  {t('home.scanHelp')}
                </p>
              )}
            </form>
          </div>

          <p className={styles.footer}>{t('home.footerLine')}</p>
          <nav className={styles.smallnav}>
            <Link to="/print">{t('home.printLink')}</Link>
            <Link to="/deck">{t('home.deckLink')}</Link>
            <Link to="/creditos">{t('home.creditsLink')}</Link>
          </nav>
        </div>

        <div className={styles.more}>
          <p className={page.lead}>{t('home.tagline')}</p>

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
                    <CardArt id={id} emoji={card.art} emojiClassName={styles.emoji} />
                    <span>{cardName(card, uiLang)?.text ?? card.id}</span>
                  </li>
                );
              })}
            </ul>
            <Link className={page.link} to="/deck">
              {t('home.sampleAll')}
            </Link>
          </section>

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

          <section className={page.section} aria-labelledby="home-faq">
            <h2 className={page.h2} id="home-faq">
              {t('home.faq.title')}
            </h2>
            <dl className={styles.faq}>
              {FAQ_KEYS.map((k) => (
                <div key={k}>
                  <dt>{t(`home.faq.items.${k}.q`)}</dt>
                  <dd>{t(`home.faq.items.${k}.a`)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={page.section} aria-labelledby="home-dev">
            <h2 className={page.h2} id="home-dev">
              {t('home.devTitle')}
            </h2>
            <p className={page.notice}>{t('home.devNotice')}</p>
          </section>

          <p>{t('home.privacyLine')}</p>
        </div>
      </div>
    </main>
  );
}
