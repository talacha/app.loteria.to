import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RosterTile } from '../ui';
import styles from './Roster.module.css';

export interface RosterPlayer {
  seat: string;
  name: string;
  glyph: string;
  pronouns?: string;
}

export interface RosterProps {
  players: RosterPlayer[];
  /** Marks this seat with "(tú)". */
  selfSeat?: string;
  /** Shown as a capacity hint. */
  max?: number;
}

export default function Roster({ players, selfSeat, max }: RosterProps) {
  const { t } = useTranslation();
  const [prev, setPrev] = useState(players);
  const [announce, setAnnounce] = useState('');
  const [seeded, setSeeded] = useState(players.length > 0);

  // Derive the live announcement while rendering (no effect needed).
  if (prev !== players && !seeded) {
    // The first non-empty roster is the baseline, not news.
    setPrev(players);
    if (players.length > 0) setSeeded(true);
  } else if (prev !== players) {
    const before = new Map(prev.map((p) => [p.seat, p]));
    const after = new Map(players.map((p) => [p.seat, p]));
    const msgs: string[] = [];
    for (const p of players)
      if (!before.has(p.seat) && p.seat !== selfSeat)
        msgs.push(t('lobby.joined', { name: p.name }));
    for (const p of prev) if (!after.has(p.seat)) msgs.push(t('lobby.left', { name: p.name }));
    setPrev(players);
    if (msgs.length) setAnnounce(msgs.join('. '));
  }

  return (
    <section className={styles.roster} aria-labelledby="roster-count">
      <h2 id="roster-count" className={styles.count}>
        {t('lobby.count', { count: players.length })}
        {max ? <span className={styles.max}> · {t('lobby.max', { max })}</span> : null}
      </h2>
      <p className={styles.live} role="status" aria-live="polite">
        {announce}
      </p>
      {players.length === 0 ? (
        <p className={styles.empty}>{t('lobby.empty')}</p>
      ) : (
        <ul className={styles.list} aria-label={t('lobby.roster')}>
          {players.map((p) => (
            <li key={p.seat}>
              <RosterTile
                name={p.name}
                glyph={p.glyph}
                detail={p.pronouns}
                self={p.seat === selfSeat}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
