import { useTranslation } from 'react-i18next';
import { PATTERNS, type CardId, type Lang, type PatternId } from '@engine';
import { cardName, getCard } from '@content';
import CardArt from './CardArt';
import styles from './WinScreen.module.css';

export interface WinScreenProps {
  board: CardId[];
  crossed: CardId[];
  pattern: PatternId;
  winners: string[];
  wonByMe: boolean;
  /** seat -> display name */
  names: Record<string, string>;
  labelLang: Lang;
  onBack: () => void;
}

const BAND = ['maiz', 'jade', 'cielo', 'paper', 'maiz', 'jade'] as const;

export default function WinScreen({
  board,
  crossed,
  pattern,
  winners,
  wonByMe,
  names,
  labelLang,
  onBack,
}: WinScreenProps) {
  const { t } = useTranslation();
  const line = wonByMe
    ? (PATTERNS[pattern].find((set) => set.every((i) => crossed.includes(board[i] as CardId))) ??
      [])
    : [];
  const lineIds = line.map((i) => board[i] as CardId);
  const wordIds = wonByMe ? lineIds : crossed.slice(0, 8);
  const patternName = t(`player.patternNames.${pattern}`);
  const winnerNames = winners.map((s) => names[s] ?? '…');

  let subtitle = t('player.winNone');
  if (winners.length > 1) subtitle = t('player.winTie', { names: winnerNames.join(', ') });
  else if (winners.length === 1)
    subtitle = wonByMe
      ? t('player.winYou', { pattern: patternName })
      : t('player.winSolo', { name: winnerNames[0], pattern: patternName });

  const words = wordIds.map((id) => {
    const card = getCard(id);
    const own = card ? cardName(card, labelLang) : null;
    const es = card ? cardName(card, 'es') : null;
    return { id, own, es: es?.text ?? id };
  });
  const anyReview = words.some((w) => w.own && w.own.status !== 'approved');

  return (
    <main id="main" className={styles.page}>
      <div className={styles.band} aria-hidden="true">
        {BAND.map((c, i) => (
          <span key={i} className={styles.flag} data-c={c} />
        ))}
      </div>
      <div className={styles.inner}>
        <h1 className={styles.title}>{t('player.winTitle')}</h1>
        <p className={styles.sub} role="status">
          {subtitle}
        </p>

        <ul className={styles.board} aria-label={t('player.tablaTitle')}>
          {board.map((id, i) => (
            <li key={id} className={styles.cell} data-line={line.includes(i)}>
              <CardArt cardId={id} className={styles.art} />
              {crossed.includes(id) && <span className={styles.bean} aria-hidden="true" />}
            </li>
          ))}
        </ul>

        <section className={styles.words} aria-labelledby="learned">
          <h2 id="learned" className={styles.h2}>
            {wonByMe ? t('player.winWordsLine') : t('player.winWordsLearned')}
          </h2>
          <ul className={styles.wordList}>
            {words.map((w) => (
              <li key={w.id}>
                {w.own ? (
                  <>
                    <strong>{w.own.text}</strong>
                    {labelLang !== 'es' && labelLang !== 'en' ? <> · {w.es.toLowerCase()}</> : null}
                  </>
                ) : (
                  <>
                    <strong>{w.es}</strong> · {t('player.noWord')}
                  </>
                )}
              </li>
            ))}
          </ul>
          {anyReview && <span className={styles.review}>{t('player.wordsReview')}</span>}
        </section>

        <div className={styles.actions}>
          <p className={styles.hint}>{t('player.anotherRoundHint')}</p>
          <button type="button" className={styles.back} onClick={onBack} autoFocus>
            {t('player.backToRoom')}
          </button>
        </div>
      </div>
    </main>
  );
}
