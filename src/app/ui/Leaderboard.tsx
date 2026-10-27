import { useTranslation } from 'react-i18next';
import { rankEntries, type LeaderboardEntry } from './rank';
import styles from './Leaderboard.module.css';

export interface LeaderboardProps {
  entries: readonly LeaderboardEntry[];
  /** Marks this seat with "Tú". */
  selfSeat?: string;
  /** Squares on a cartón (g x g); default 16. */
  total?: number;
  /** Caption; defaults to "Tabla de puntos". Always available to screen readers. */
  label?: string;
  /** Cap the height and scroll inside (the cantor screen). */
  scroll?: boolean;
  className?: string;
}

export default function Leaderboard({
  entries,
  selfSeat,
  total = 16,
  label,
  scroll = false,
  className,
}: LeaderboardProps) {
  const { t } = useTranslation();
  const rows = rankEntries(entries);
  const caption = label ?? t('ui.leaderboard.title');
  return (
    <div
      className={[styles.wrap, scroll ? styles.scroll : '', className].filter(Boolean).join(' ')}
      tabIndex={scroll ? 0 : undefined}
      role={scroll ? 'region' : undefined}
      aria-label={scroll ? caption : undefined}
    >
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('ui.leaderboard.rank')}</th>
            <th scope="col">{t('ui.leaderboard.player')}</th>
            <th scope="col" className={styles.num}>
              {t('ui.leaderboard.points')}
            </th>
            <th scope="col" className={styles.num}>
              {t('ui.leaderboard.squares')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.seat}
              data-first={r.rank === 1 ? 'true' : undefined}
              data-self={r.seat === selfSeat ? 'true' : undefined}
            >
              <th scope="row" className={styles.rank}>
                {r.rank}
              </th>
              <td className={styles.who}>
                {r.glyph ? (
                  <span className={styles.glyph} aria-hidden="true">
                    {r.glyph}
                  </span>
                ) : null}
                <span className={styles.name}>{r.name}</span>
                {r.seat === selfSeat ? (
                  <span className={styles.you}>{t('ui.leaderboard.you')}</span>
                ) : null}
              </td>
              <td className={styles.num}>{r.points}</td>
              <td
                className={styles.num}
                aria-label={t('ui.leaderboard.squaresOf', { n: r.crossed, total })}
              >
                {r.crossed}/{total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
