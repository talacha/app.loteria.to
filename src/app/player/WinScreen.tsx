import { useTranslation } from 'react-i18next';
import type { CardId, Lang } from '@engine';
import { Button, PapelPicado, PaperCard, Tabla, type CellData } from '../ui';
import { emojiOf, wordOf } from './words';
import styles from './WinScreen.module.css';

export interface WinScreenProps {
  board: CardId[];
  crossed: CardId[];
  winners: string[];
  wonByMe: boolean;
  /** seat -> display name */
  names: Record<string, string>;
  /** seat -> points; decides the text of a tie. */
  points: Record<string, number>;
  spokenLang: Lang;
  /** "Otra ronda": wait for the next round. */
  onAnother: () => void;
  /** "Volver a la sala". */
  onBack: () => void;
}

export default function WinScreen({
  board,
  crossed,
  winners,
  wonByMe,
  names,
  points,
  spokenLang,
  onAnother,
  onBack,
}: WinScreenProps) {
  const { t } = useTranslation();
  const winnerNames = winners.map((s) => names[s] ?? '…');
  const winnerPoints = winners.length > 0 ? Math.max(...winners.map((s) => points[s] ?? 0)) : 0;

  let subtitle = t('player.winNone');
  if (winners.length > 1)
    subtitle = t('player.winTie', { names: winnerNames.join(', '), points: winnerPoints });
  else if (winners.length === 1)
    subtitle = wonByMe
      ? t('player.winYou', { points: winnerPoints })
      : t('player.winSolo', { name: winnerNames[0], points: winnerPoints });

  // The round is over: every crossed square shows its word.
  const cells: CellData[] = board.map((id) => ({
    id,
    emoji: emojiOf(id),
    label: crossed.includes(id) ? wordOf(id, spokenLang) : '',
    marked: crossed.includes(id),
  }));

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
            {t('player.winWords')}
          </h2>
          <ul className={styles.wordList}>
            {board
              .filter((id) => crossed.includes(id))
              .map((id) => (
                <li key={id} lang={spokenLang}>
                  <strong>{wordOf(id, spokenLang)}</strong>
                </li>
              ))}
          </ul>
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
