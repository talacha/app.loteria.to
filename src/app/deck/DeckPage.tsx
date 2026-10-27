import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, cards, callableLangs, cardName, type Category, type Lang } from '@content';
import page from '../theme/page.module.css';
import styles from './DeckPage.module.css';

const NATIVE: Lang[] = ['nah', 'yua', 'quz'];

export default function DeckPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const callable = callableLangs();
  const shown = category === 'all' ? cards : cards.filter((c) => c.category === category);
  const pending = NATIVE.filter((l) => !callable.includes(l));

  return (
    <main className={page.page} id="main">
      <nav className={page.nav}>
        <Link to="/">{t('deck.home')}</Link>
      </nav>
      <header className={page.section}>
        <h1 className={page.h1}>{t('deck.title')}</h1>
        <p className={page.lead}>{t('deck.intro')}</p>
        {pending.length > 0 && (
          <p className={page.notice}>
            {t('deck.pendingLangs', { langs: pending.map((l) => t(`lang.${l}`)).join(', ') })}
          </p>
        )}
      </header>

      <div role="group" aria-label={t('deck.filterLabel')} className={styles.filters}>
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={page.btn}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c === 'all' ? t('deck.all') : t(`deck.categories.${c}`)}
          </button>
        ))}
      </div>
      <p className={page.muted} aria-live="polite">
        {t('deck.count', { count: shown.length })}
      </p>

      <ul className={styles.grid}>
        {shown.map((card) => {
          const es = cardName(card, 'es');
          const en = cardName(card, 'en');
          return (
            <li key={card.id} className={styles.card}>
              <span className={styles.num}>{t('deck.cardNumber', { n: card.n })}</span>
              <span className={styles.emoji} aria-hidden="true">
                {card.art}
              </span>
              <ul className={styles.names}>
                <li className={styles.primary} lang="es">
                  {es?.text}
                </li>
                <li className={page.muted} lang="en">
                  {en?.text}
                </li>
              </ul>
              {NATIVE.map((lang) => {
                const n = cardName(card, lang);
                if (!n) return null;
                return (
                  <span key={lang} className={styles.native} lang={lang}>
                    <span>
                      <span className="sr-only">{t(`lang.${lang}`)}: </span>
                      {n.text}
                    </span>
                    {n.status === 'draft' && (
                      <span className={page.badge}>{t('deck.draftUnreviewed')}</span>
                    )}
                    {n.status === 'reviewed' && (
                      <span className={page.badge}>{t('deck.reviewedBadge')}</span>
                    )}
                  </span>
                );
              })}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
