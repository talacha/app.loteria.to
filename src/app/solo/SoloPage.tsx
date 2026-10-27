import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@engine';
import { callableLangs, cards, isAvoidedPair } from '@content';
import { applyStoredPrefs } from '../theme/prefs';
import { LanguageSwitch } from '../theme/Preferences';
import { readProfile } from '../home/profile';
import { Button, PapelPicado, Panel, Pill } from '../ui';
import page from '../theme/page.module.css';
import SoloGame, { type SoloPlayerInfo } from './SoloGame';
import {
  HUMAN,
  MAX_CPUS,
  SPEEDS_SEC,
  createSolo,
  cpuSeat,
  type Difficulty,
  type SoloState,
} from './soloEngine';
import styles from './SoloPage.module.css';

applyStoredPrefs();

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const SPEED_KEYS: Record<number, string> = { 6: 'fast', 8: 'mid', 12: 'slow' };
const CPU_AVATARS = ['jaguar', 'rana', 'mariposa'];
const SPOKEN_KEY = 'loteria:solo:lang';

function newSeed(): string {
  return `solo-${Math.random().toString(36).slice(2, 10)}`;
}

function initialSpoken(options: Lang[]): Lang {
  try {
    const v = localStorage.getItem(SPOKEN_KEY) as Lang | null;
    if (v && options.includes(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return options.includes('es') ? 'es' : (options[0] ?? 'es');
}

export default function SoloPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const options = useMemo<Lang[]>(() => {
    const l = callableLangs();
    return l.length ? l : ['es', 'en'];
  }, []);
  const [cpus, setCpus] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [speedSec, setSpeedSec] = useState<number>(8);
  const [spoken, setSpoken] = useState<Lang>(() => initialSpoken(options));
  const [game, setGame] = useState<{ state: SoloState; key: number } | null>(null);
  const [done, setDone] = useState<SoloState | null>(null);
  const profile = useMemo(() => readProfile(), []);

  const players = useMemo<SoloPlayerInfo[]>(
    () => [
      { seat: HUMAN, name: profile.name || t('solo.you'), avatar: 'jaguar' },
      ...Array.from({ length: MAX_CPUS }, (_, k) => ({
        seat: cpuSeat(k + 1),
        name: t('solo.cpu', { n: k + 1 }),
        avatar: CPU_AVATARS[k] ?? 'rana',
      })),
    ],
    [profile.name, t],
  );

  function start() {
    try {
      localStorage.setItem(SPOKEN_KEY, spoken);
    } catch {
      /* storage unavailable */
    }
    const pool = cards.map((c) => ({ id: c.id, category: c.category }));
    const state = createSolo({
      seed: newSeed(),
      cpus,
      difficulty,
      speedSec,
      pool,
      exclude: (a, b) => isAvoidedPair(a, b, [spoken]),
    });
    setDone(null);
    setGame((g) => ({ state, key: (g?.key ?? 0) + 1 }));
  }

  const finish = useCallback((s: SoloState) => setDone(s), []);
  const nameOf = (seat: string) => players.find((p) => p.seat === seat)?.name ?? seat;

  if (game && done?.ended) {
    const { winners } = done.ended;
    const youWon = winners.includes(HUMAN);
    const names = winners.map(nameOf).join(', ');
    const ranking = done.seats
      .map((seat) => ({ seat, pts: done.pick.points[seat] ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    return (
      <main className={`${page.page} ${styles.end}`} id="main" data-won={youWon}>
        <PapelPicado />
        <h1 className={styles.hero}>{t('solo.loteria')}</h1>
        <p className={styles.winner}>
          {t(winners.length > 1 ? 'solo.winnerMany' : 'solo.winnerOne', { names })}
        </p>
        <p className={styles.result}>{youWon ? t('solo.youWon') : t('solo.youLost')}</p>
        {winners.length > 1 ? <p>{t('solo.tieNote')}</p> : null}
        <Panel as="section" className={styles.scores}>
          <ol className={styles.rank}>
            {ranking.map((r) => (
              <li key={r.seat} data-win={winners.includes(r.seat)}>
                <span>{nameOf(r.seat)}</span>
                <span>{t('solo.points', { n: r.pts })}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Button onClick={start}>{t('solo.again')}</Button>
        <Button variant="link" onClick={() => setGame(null)}>
          {t('solo.title')}
        </Button>
        <Button variant="link" onClick={() => void navigate('/')}>
          {t('solo.back')}
        </Button>
      </main>
    );
  }

  if (game) {
    return (
      <SoloGame
        key={game.key}
        initial={game.state}
        lang={spoken}
        players={players}
        onFinish={finish}
      />
    );
  }

  return (
    <main className={page.page} id="main">
      <div className={styles.top}>
        <h1 className={page.h1}>{t('solo.title')}</h1>
        <LanguageSwitch />
      </div>
      <p className={page.lead}>{t('solo.intro')}</p>
      <Pill tone="jade" dot>
        {t('solo.offline')}
      </Pill>

      <fieldset className={styles.group}>
        <legend>{t('solo.opponents')}</legend>
        <div className={styles.chips} role="radiogroup" aria-label={t('solo.opponents')}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={cpus === n}
              className={styles.chip}
              onClick={() => setCpus(n)}
            >
              {t('solo.opponentsN', { n })}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('solo.difficulty')}</legend>
        <div className={styles.chips} role="radiogroup" aria-label={t('solo.difficulty')}>
          {DIFFS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={difficulty === d}
              className={styles.chip}
              onClick={() => setDifficulty(d)}
            >
              {t(`solo.${d}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('solo.speed')}</legend>
        <div className={styles.chips} role="radiogroup" aria-label={t('solo.speed')}>
          {SPEEDS_SEC.map((sec) => (
            <button
              key={sec}
              type="button"
              role="radio"
              aria-checked={speedSec === sec}
              className={styles.chip}
              onClick={() => setSpeedSec(sec)}
            >
              {t(`solo.${SPEED_KEYS[sec]}`)} · {t('solo.speedN', { n: sec })}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('solo.spoken')}</legend>
        <div className={styles.chips} role="radiogroup" aria-label={t('solo.spoken')}>
          {options.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={spoken === l}
              className={styles.chip}
              onClick={() => setSpoken(l)}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <Button onClick={start}>{t('solo.start')}</Button>
        <Button variant="link" onClick={() => void navigate('/')}>
          {t('solo.back')}
        </Button>
      </div>
    </main>
  );
}
