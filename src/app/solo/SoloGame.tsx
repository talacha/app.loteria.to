import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardId, Lang } from '@engine';
import { cardName, getCard } from '@content';
import { speakCall, stopAudio } from '../audio';
import {
  Button,
  CardArt,
  FeedbackStrip,
  HistoryStrip,
  Leaderboard,
  LanguageSettings,
  Sheet,
  type LeaderboardEntry,
  Panel,
  PaperCard,
  Pill,
  ProgressBar,
  ReviewTag,
  Tabla,
  type CellData,
} from '../ui';
import {
  HUMAN,
  SPEEDS_SEC,
  humanPick,
  remainingSquares,
  setPaused,
  setSpeed,
  tick,
  type SoloState,
} from './soloEngine';
import styles from './SoloGame.module.css';

export interface SoloPlayerInfo {
  seat: string;
  name: string;
  /** Card id used as the avatar picture. */
  avatar: string;
}

type Action =
  | { type: 'tick'; dt: number }
  | { type: 'pick'; cardId: CardId }
  | { type: 'pause'; paused: boolean }
  | { type: 'speed'; sec: number };

function reducer(s: SoloState, a: Action): SoloState {
  switch (a.type) {
    case 'tick':
      return tick(s, a.dt);
    case 'pick':
      return humanPick(s, a.cardId).s;
    case 'pause':
      return setPaused(s, a.paused);
    case 'speed':
      return setSpeed(s, a.sec);
  }
}

function wordOf(id: CardId, lang: Lang): { text: string; draft: boolean } {
  const c = getCard(id);
  if (!c) return { text: id, draft: false };
  const n = cardName(c, lang) ?? cardName(c, 'es');
  return { text: n?.text ?? id, draft: !!n && n.status !== 'approved' };
}
const emojiOf = (id: CardId): string => {
  const c = getCard(id);
  return c?.emoji ?? c?.art ?? '?';
};

export default function SoloGame({
  initial,
  lang,
  players,
  onFinish,
  onLeave,
}: {
  initial: SoloState;
  lang: Lang;
  players: SoloPlayerInfo[];
  onFinish: (s: SoloState) => void;
  /** "Salir": leave the game (never ends the round for anyone else; there is no one else). */
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const [s, dispatch] = useReducer(reducer, initial);
  const last = useRef(0);
  const [leaving, setLeaving] = useState(false);
  const [languageSettings, setLanguageSettings] = useState(false);

  // Clock: advances only while the game is running (pause stops it).
  useEffect(() => {
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(500, now - last.current);
      last.current = now;
      dispatch({ type: 'tick', dt });
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (s.ended) onFinish(s);
  }, [s, onFinish]);

  const call = s.call;
  const callId = call?.cardId;
  const callIndex = call?.i;
  useEffect(() => {
    const card = callId ? getCard(callId) : undefined;
    if (card && !s.paused) void speakCall(card, lang);
    // Speak once per call; pausing must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callIndex]);
  useEffect(() => () => stopAudio(), []);

  const replay = useCallback(() => {
    const card = callId ? getCard(callId) : undefined;
    if (card) void speakCall(card, lang);
  }, [callId, lang]);

  const crossed = useMemo(() => new Set(s.crossed[HUMAN]), [s.crossed]);
  const mine = s.tablas[HUMAN];
  const cells: CellData[] = (mine?.cards ?? []).map((id) => ({
    id,
    emoji: emojiOf(id),
    label: crossed.has(id) ? wordOf(id, lang).text : '',
    marked: crossed.has(id),
  }));
  const history = s.called
    .slice(-8)
    .reverse()
    .map((id) => ({ id, emoji: emojiOf(id), label: wordOf(id, lang).text }));

  let feedback: { tone: 'neutral' | 'ok' | 'casi'; title?: string; text?: string } = {
    tone: 'neutral',
    title: s.paused ? t('solo.paused') : t('solo.listen'),
  };
  if (call && call.humanPoints > 0) {
    feedback = { tone: 'ok', title: t(call.humanPoints === 2 ? 'solo.okFirst' : 'solo.okOther') };
  } else if (call && call.humanWrong.length > 0) {
    feedback = {
      tone: 'casi',
      title: t('solo.casi'),
      text: call.humanWrong.length < 2 ? t('solo.casiText') : undefined,
    };
  }

  const standings: LeaderboardEntry[] = players
    .filter((p) => s.seats.includes(p.seat))
    .map((p) => ({
      seat: p.seat,
      name: p.name,
      glyph: emojiOf(p.avatar),
      points: s.pick.points[p.seat] ?? 0,
      crossed: s.crossed[p.seat]?.length ?? 0,
    }));
  const windowMs = s.cfg.speedSec * 1000;
  const total = s.order.length;
  const disabled =
    !call || s.paused || call.humanPoints > 0 || call.humanWrong.length >= 2 || !!s.ended;
  const draftCall = call ? wordOf(call.cardId, lang).draft : false;

  return (
    <main className={styles.game} id="main">
      <header className={styles.head}>
        <div className={styles.headInfo}>
          <Pill tone={lang}>{t(`lang.${lang}`)}</Pill>
          <span className={styles.count}>
            {t('solo.callN', { n: Math.min(total, s.called.length + (call ? 1 : 0)), total })}
          </span>
        </div>
        <div className={styles.controls}>
          <Button
            variant="secondary"
            fit
            aria-haspopup="dialog"
            onClick={() => setLanguageSettings(true)}
          >
            {t('theme.kit.gear.label')}
          </Button>
          <Button
            variant="secondary"
            fit
            onClick={() => {
              dispatch({ type: 'pause', paused: true });
              setLeaving(true);
            }}
          >
            {t('solo.leave')}
          </Button>
          <Button
            variant="secondary"
            fit
            onClick={() => dispatch({ type: 'pause', paused: !s.paused })}
            aria-pressed={s.paused}
          >
            {s.paused ? t('solo.resume') : t('solo.pause')}
          </Button>
          <div className={styles.speeds} role="group" aria-label={t('solo.speed')}>
            {SPEEDS_SEC.map((sec) => (
              <button
                key={sec}
                type="button"
                className={styles.speed}
                aria-pressed={s.cfg.speedSec === sec}
                aria-label={t('solo.speedN', { n: sec })}
                onClick={() => dispatch({ type: 'speed', sec })}
              >
                {sec} s
              </button>
            ))}
          </div>
        </div>
      </header>

      <Panel as="section" className={styles.scores} aria-labelledby="solo-pts">
        <h2 id="solo-pts" className={styles.h2}>
          {t('theme.kit.leaderboard.title')}
        </h2>
        <Leaderboard entries={standings} selfSeat={HUMAN} total={s.tablas[HUMAN]?.cards.length} />
      </Panel>

      <Panel className={styles.callPanel}>
        <PaperCard size="lg" className={styles.callCard}>
          {call ? (
            <CardArt id={call.cardId} emoji={emojiOf(call.cardId)} className={styles.callArt} />
          ) : null}
        </PaperCard>
        <div className={styles.callSide}>
          <button
            type="button"
            className={styles.replay}
            onClick={replay}
            aria-label={t('solo.replay')}
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9v6h4l5 4V5L8 9H4z" />
              <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
            </svg>
          </button>
          <div className={styles.points} aria-live="polite">
            {t('solo.you')} · {t('solo.points', { n: s.pick.points[HUMAN] ?? 0 })}
          </div>
          {draftCall || lang !== 'es' ? <ReviewTag variant="ai" /> : null}
        </div>
        <div className={styles.timer}>
          <ProgressBar
            value={call ? call.elapsedMs / windowMs : 0}
            label={t('theme.kit.progress')}
          />
        </div>
      </Panel>

      <div className={styles.choices} role="group" aria-label={t('solo.choicesLabel')}>
        {(call?.choices ?? []).map((id) => {
          const w = wordOf(id, lang);
          const wrong = call?.humanWrong.includes(id);
          const right = call?.humanPoints ? id === call.cardId : false;
          return (
            <button
              key={id}
              type="button"
              className={styles.choice}
              data-state={right ? 'correct' : wrong ? 'wrong' : 'idle'}
              disabled={disabled || wrong}
              onClick={() => dispatch({ type: 'pick', cardId: id })}
            >
              {w.text}
            </button>
          );
        })}
      </div>

      <FeedbackStrip tone={feedback.tone} title={feedback.title}>
        {feedback.text}
      </FeedbackStrip>

      <section className={styles.board} aria-label={t('solo.board')}>
        <h2 className={styles.h2}>{t('solo.board')}</h2>
        <Tabla cells={cells} label={t('solo.board')} />
        <p className={styles.mine}>{t('solo.squaresLeft', { n: remainingSquares(s, HUMAN) })}</p>
      </section>

      <Sheet
        title={t('theme.settings.title')}
        open={languageSettings}
        onClose={() => setLanguageSettings(false)}
      >
        <LanguageSettings />
      </Sheet>

      <Sheet title={t('solo.leaveTitle')} open={leaving} onClose={() => setLeaving(false)}>
        <p>{t('solo.leaveBody')}</p>
        <Button variant="secondary" onClick={() => setLeaving(false)}>
          {t('solo.keepPlaying')}
        </Button>
        <Button variant="primary" onClick={onLeave}>
          {t('solo.leave')}
        </Button>
      </Sheet>

      {history.length > 0 ? <HistoryStrip items={history} title={t('solo.history')} /> : null}
    </main>
  );
}
