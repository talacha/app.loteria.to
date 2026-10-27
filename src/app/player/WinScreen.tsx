import { useTranslation } from 'react-i18next';
import { PATTERNS, type CardId, type Lang, type PatternId } from '@engine';
import { cardName, getCard } from '@content';
import { Button, PapelPicado, PaperCard, ReviewTag, Tabla, type CellData } from '../ui';
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
  /** "Otra ronda": wait for the next round. */
  onAnother: () => void;
  /** "Volver a la sala". */
  onBack: () => void;
}

export default function WinScreen({
  board,
  crossed,
  pattern,
  winners,
  wonByMe,
  names,
  labelLang,
  onAnother,
  onBack,
}: WinScreenProps) {
  const { t } = useTranslation();
  const line = wonByMe
    ? (PATTERNS[pattern].find((set) => set.every((i) => crossed.includes(board[i] as CardId))) ??
      [])
    : [];
  const wordIds = wonByMe ? line.map((i) => board[i] as CardId) : crossed.slice(0, 8);
  const patternName = t(`player.patternNames.${pattern}`);
  const winnerNames = winners.map((s) => names[s] ?? '…');

  let subtitle = t('player.winNone');
  if (winners.length > 1) subtitle = t('player.winTie', { names: winnerNames.join(', ') });
  else if (winners.length === 1)
    subtitle = wonByMe
      ? t('player.winYou', { pattern: patternName })
      : t('player.winSolo', { name: winnerNames[0], pattern: patternName });

  const cells: CellData[] = board.map((id, i) => {
    const c = getCard(id);
    return {
      id,
      emoji: c?.emoji ?? c?.art ?? '?',
      label: (c && (cardName(c, labelLang) ?? cardName(c, 'es'))?.text) || id,
      marked: crossed.includes(id),
      winning: line.includes(i),
    };
  });

  const words = wordIds.map((id) => {
    const card = getCard(id);
    const own = card ? cardName(card, labelLang) : null;
    const es = card ? cardName(card, 'es') : null;
    return { id, own, es: es?.text ?? id };
  });
  const anyReview = words.some((w) => w.own && w.own.status !== 'approved');

  return (
    <main id="main" className={styles.page}>
      <PapelPicado />
      <div className={styles.inner}>
        <h1 className={styles.title}>{t('player.winTitle')}</h1>
        <p className={styles.sub} role="status">
          {subtitle}
        </p>

        <div className={styles.board}>
          <Tabla cells={cells} label={t('player.tablaTitle')} />
        </div>

        <PaperCard as="section" aria-labelledby="learned" className={styles.words}>
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
          {anyReview && <ReviewTag variant="words" />}
        </PaperCard>

        <div className={styles.actions}>
          <Button onClick={onAnother} autoFocus>
            {t('player.anotherRound')}
          </Button>
          <p className={styles.hint}>{t('player.anotherRoundHint')}</p>
          <Button variant="link" className={styles.back} onClick={onBack}>
            {t('player.backToRoom')}
          </Button>
        </div>
      </div>
    </main>
  );
}
