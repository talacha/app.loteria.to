import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { maxGridFor, minDeckFor, MAX_GRID, MIN_GRID, type Lang } from '@engine';
import { callableLangs, cardsAvailableIn, langsForDeck, getCard, isAvoidedPair } from '@content';
import { applyStoredPrefs } from '../theme/prefs';
import { LanguageSwitch } from '../theme/Preferences';
import { readProfile } from '../home/profile';
import { readRawProfile, setAllowedSpokenLangs } from '../ui/profile';
import { patchLocalProfile, readLocalProfile } from '../player/profile';
import {
  Button,
  Leaderboard,
  useProfile,
  PapelPicado,
  Panel,
  Pill,
  type LeaderboardEntry,
} from '../ui';
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
  const shared = readLocalProfile().spokenLang;
  if (shared && options.includes(shared)) return shared;
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
  const [grid, setGrid] = useState(4);
  const [spoken, setSpoken] = useState<Lang>(() => initialSpoken(options));
  const [game, setGame] = useState<{ state: SoloState; key: number } | null>(null);
  const [done, setDone] = useState<SoloState | null>(null);
  const profile = useMemo(() => readProfile(), []);
  const availablePool = cardsAvailableIn([spoken]);
  useEffect(() => {
    if (!game) return;
    setAllowedSpokenLangs(langsForDeck(game.state.order));
    return () => setAllowedSpokenLangs(null);
  }, [game]);
  // Setup, the in-game sheet and the global gear share one spoken preference.
  useEffect(() => {
    if (readRawProfile().spokenLang !== spoken) patchLocalProfile({ spokenLang: spoken });
    try {
      localStorage.setItem(SPOKEN_KEY, spoken);
    } catch {
      /* storage unavailable */
    }
  }, [spoken]);
  // The header gear changes the spoken language: follow it, also during a game.
  const gearLang = useProfile().spokenLang;
  const [seenGear, setSeenGear] = useState(gearLang);
  if (seenGear !== gearLang) {
    setSeenGear(gearLang);
    if (options.includes(gearLang) && (!game || langsForDeck(game.state.order).includes(gearLang)))
      setSpoken(gearLang);
  }

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
    const pool = availablePool.map((c) => ({ id: c.id, category: c.category }));
    const state = createSolo({
      seed: newSeed(),
      cpus,
      difficulty,
      speedSec,
      pool,
      exclude: (a, b) => isAvoidedPair(a, b, [spoken]),
      grid: Math.min(grid, maxGridFor(pool.length, cpus + 1) || 4),
    });
    setDone(null);
    setGame((g) => ({ state, key: (g?.key ?? 0) + 1 }));
  }

  const finish = useCallback((s: SoloState) => setDone(s), []);
  const avatarOf = (seat: string) => {
    const id = players.find((p) => p.seat === seat)?.avatar;
    const c = id ? getCard(id) : undefined;
    return c?.emoji ?? c?.art;
  };
  const nameOf = (seat: string) => players.find((p) => p.seat === seat)?.name ?? seat;

  if (game && done?.ended) {
    const { winners } = done.ended;
    const youWon = winners.includes(HUMAN);
    const names = winners.map(nameOf).join(', ');
    const standings: LeaderboardEntry[] = done.seats.map((seat) => ({
      seat,
      name: nameOf(seat),
      glyph: avatarOf(seat),
      points: done.pick.points[seat] ?? 0,
      crossed: done.crossed[seat]?.length ?? 0,
    }));
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
          <Leaderboard
            entries={standings}
            selfSeat={HUMAN}
            total={done.tablas[HUMAN]?.cards.length}
            label={t('solo.finalStandings')}
          />
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
        onLeave={() => setGame(null)}
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
        <legend>{t('solo.grid')}</legend>
        <p id="solo-grid-help">{t('solo.gridHelp')}</p>
        <div
          className={styles.chips}
          role="radiogroup"
          aria-label={t('solo.grid')}
          aria-describedby="solo-grid-help"
        >
          {Array.from({ length: MAX_GRID - MIN_GRID + 1 }, (_, k) => MIN_GRID + k).map((g) => {
            const ok = availablePool.length >= minDeckFor(g, cpus + 1);
            return (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={Math.min(grid, maxGridFor(availablePool.length, cpus + 1)) === g}
                aria-disabled={!ok}
                className={styles.chip}
                onClick={() => ok && setGrid(g)}
              >
                {g}×{g}
                {ok ? '' : ` · ${t('solo.needs', { n: minDeckFor(g, cpus + 1) })}`}
              </button>
            );
          })}
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
