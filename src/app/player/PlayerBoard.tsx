import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardId, Lang } from '@engine';
import { cardName, getCard } from '@content';
import type { Msg, Transport } from '@net';
import type { MessageLog } from '../lobby/messageLog';
import { speakCall } from '../audio';
import {
  Button,
  CallPanel,
  ChoiceTile,
  FeedbackStrip,
  Panel,
  Pill,
  Tabla,
  type CellData,
  type PillTone,
} from '../ui';
import WinScreen from './WinScreen';
import {
  canClaim,
  completedSet,
  initialPlayerState,
  playerReducer,
  CLAIM_REPLY_TIMEOUT_MS,
} from './playerState';
import styles from './PlayerBoard.module.css';

export interface PlayerProfile {
  name: string;
  glyph: string;
  pronouns?: string;
  labelLang: Lang;
  /** Escucha: hide the written word, play by ear. */
  listenOnly?: boolean;
}

export interface PlayerBoardProps {
  transport: Transport;
  room: { code: string; seat: string; hostVerified: boolean };
  roster?: { seat: string; name?: string }[];
  profile: PlayerProfile;
  /** Lobby message buffer; when absent the board listens to the transport directly. */
  log?: MessageLog;
  onLeave?: () => void;
  /** "Volver a la sala" from the win screen; falls back to just closing the win screen. */
  onBackToLobby?: () => void;
}

const TEXT_SCALES = [100, 115, 130, 150];
const marksKey = (code: string, seed: string, roundNo: number) =>
  `loteria:marks:${code}:${seed}:${roundNo}`;

function loadMarks(code: string, seed: string, roundNo: number): CardId[] {
  try {
    const raw = sessionStorage.getItem(marksKey(code, seed, roundNo));
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function label(id: CardId, lang: Lang): string {
  const c = getCard(id);
  if (!c) return id;
  return (cardName(c, lang) ?? cardName(c, 'es'))?.text ?? id;
}
function emoji(id: CardId): string {
  const c = getCard(id);
  return c?.emoji ?? c?.art ?? '?';
}

function Modal(props: {
  labelId: string;
  onClose?: () => void;
  celebrate?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={styles.dialog}
      data-celebrate={props.celebrate ? '' : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={props.labelId}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape' && props.onClose) props.onClose();
      }}
    >
      {props.children}
    </div>
  );
}

export default function PlayerBoard({
  transport,
  room,
  roster,
  profile,
  log,
  onBackToLobby,
}: PlayerBoardProps) {
  const { t } = useTranslation();
  const { code } = room;
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const [lost, setLost] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());
  const [scaleIdx, setScaleIdx] = useState(() => {
    try {
      const n = Number(localStorage.getItem('loteria:textScale'));
      return n >= 0 && n < TEXT_SCALES.length ? n : 0;
    } catch {
      return 0;
    }
  });
  const [contrast, setContrast] = useState(
    () => document.documentElement.dataset.theme === 'contrast',
  );
  const claimWrap = useRef<HTMLDivElement>(null);
  const wasModal = useRef(false);
  const { name, labelLang } = profile;
  const startListen = profile.listenOnly === true;
  useEffect(() => {
    if (startListen) dispatch({ type: 'setListenOnly', on: true });
  }, [startListen]);

  useEffect(() => {
    const handle = (m: Msg) => {
      switch (m.t) {
        case 'round':
          dispatch({
            type: 'round',
            round: {
              roomSeed: m.seed,
              roundNo: m.roundNo,
              pattern: m.pattern,
              mode: m.mode,
              callLang: m.callLang,
              speedSec: m.speedSec,
            },
            called: m.called,
            crossed: loadMarks(code, m.seed, m.roundNo),
          });
          break;
        case 'assign':
          if (m.seat === transport.seat)
            dispatch({ type: 'assign', tablaIndex: m.tablaIndex, roundNo: m.roundNo });
          break;
        case 'call':
          dispatch({
            type: 'call',
            cardId: m.cardId,
            choices: m.choices,
            lang: m.lang,
            i: m.i,
            now: Date.now(),
          });
          break;
        case 'pickResult':
          if (m.seat === transport.seat)
            dispatch({
              type: 'pickResult',
              roundNo: m.roundNo,
              i: m.i,
              correct: m.correct,
              first: m.first,
            });
          break;
        case 'scores':
          dispatch({ type: 'scores', roundNo: m.roundNo, points: m.points });
          break;
        case 'claimResult':
          if (m.seat === transport.seat)
            dispatch({
              type: 'claimResult',
              roundNo: m.roundNo,
              valid: m.valid,
              missing: m.missing,
            });
          break;
        case 'end':
          dispatch({ type: 'end', roundNo: m.roundNo, winners: m.winners, seat: transport.seat });
          break;
        default:
          break;
      }
    };
    const offErr = transport.onError?.(() => setLost(true));
    let off: () => void;
    if (log) {
      let next = 0;
      const drain = () => {
        while (next < log.items.length) handle(log.items[next++]!);
      };
      off = log.subscribe(drain);
      drain();
    } else {
      off = transport.onMessage(handle);
    }
    return () => {
      off();
      offErr?.();
    };
  }, [transport, code, log]);

  // Persist marks per code + seed + round.
  useEffect(() => {
    if (!state.round || state.board.length === 0) return;
    try {
      sessionStorage.setItem(
        marksKey(code, state.round.roomSeed, state.round.roundNo),
        JSON.stringify(state.crossed),
      );
    } catch {
      /* ignore */
    }
  }, [code, state.round, state.board, state.crossed]);

  // Re-enable the claim button when the cooldown ends.
  useEffect(() => {
    const wait = state.claimUntil - Date.now();
    if (wait <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), wait + 20);
    return () => clearTimeout(id);
  }, [state.claimUntil]);

  // Stop "waiting" if the host never answers.
  useEffect(() => {
    if (!state.claimPending) return;
    const id = setTimeout(() => dispatch({ type: 'claimTimeout' }), CLAIM_REPLY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [state.claimPending, state.claimUntil]);

  useEffect(() => {
    try {
      localStorage.setItem('loteria:textScale', String(scaleIdx));
    } catch {
      /* ignore */
    }
  }, [scaleIdx]);

  useEffect(() => {
    const el = document.documentElement;
    const prev = el.dataset.theme;
    if (contrast) el.dataset.theme = 'contrast';
    else if (el.dataset.theme === 'contrast') delete el.dataset.theme;
    return () => {
      if (prev === undefined) {
        if (el.dataset.theme === 'contrast') delete el.dataset.theme;
      } else el.dataset.theme = prev;
    };
  }, [contrast]);

  const claim = useCallback(() => {
    const tr = transport;
    const idx = state.assign?.tablaIndex;
    if (idx === undefined || !state.round) return;
    const n = Date.now();
    if (!canClaim(state, n)) return;
    dispatch({ type: 'claim', now: n });
    setNow(n);
    tr.send({
      t: 'claim',
      seat: tr.seat,
      roundNo: state.round.roundNo,
      tablaIndex: idx,
      marks: state.crossed,
    });
  }, [state, transport]);

  // Speak each new call; the speaker button replays it.
  const cur = state.current;
  const round = state.round;
  const board = state.board;
  const hidden = round?.mode === 'escucha' || state.listenOnly;
  const speak = useCallback((cardId: CardId, lang: Lang) => {
    const card = getCard(cardId);
    if (!card) return;
    try {
      void speakCall(card, lang).catch(() => undefined);
    } catch {
      /* no audio available */
    }
  }, []);
  const curKey = cur ? `${cur.i}:${cur.cardId}:${cur.lang}` : '';
  useEffect(() => {
    if (cur) speak(cur.cardId, cur.lang);
    // Only when a different call arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey, speak]);

  // Call timer: from the local receive time plus the round's speed.
  const speedMs = (round?.speedSec ?? 8) * 1000;
  const open = !!cur && !state.currentExpired;
  useEffect(() => {
    if (!open || !cur) return;
    const id = setInterval(() => {
      const n = Date.now();
      setTick(n);
      if (n - cur.receivedAt >= speedMs) dispatch({ type: 'expire', i: cur.i });
    }, 250);
    return () => clearInterval(id);
  }, [open, cur, speedMs]);
  const progress = cur ? (state.currentExpired ? 1 : (tick - cur.receivedAt) / speedMs) : 0;

  const pick = (cardId: CardId) => {
    const c = state.current;
    if (!c || !state.round) return;
    dispatch({ type: 'pick', cardId });
    transport.send({
      t: 'pick',
      seat: transport.seat,
      roundNo: state.round.roundNo,
      i: c.i,
      cardId,
    });
  };

  const set = completedSet(state);
  const canPress = canClaim(state, now);
  const showResult = state.claimResult !== null;
  const endedOpen = state.ended !== null && !state.ended.dismissed;
  const modalOpen = showResult;

  useEffect(() => {
    if (wasModal.current && !modalOpen) claimWrap.current?.querySelector('button')?.focus();
    wasModal.current = modalOpen;
  }, [modalOpen]);

  const missingText = (state.claimResult?.missing ?? [])
    .slice(0, 4)
    .map((id) => label(id, labelLang))
    .join(', ');

  const langName = (l: Lang) => t(`lobby.langs.${l}.name`);
  const nameOf = (id: CardId, l: Lang) => {
    const c = getCard(id);
    return c ? (cardName(c, l)?.text ?? null) : null;
  };
  const inReview = (id: CardId, l: Lang) => {
    const c = getCard(id);
    const n = c ? cardName(c, l) : null;
    return !!n && n.status !== 'approved';
  };

  if (endedOpen && state.ended && round && board.length > 0) {
    const names: Record<string, string> = { [transport.seat]: name };
    for (const r of roster ?? []) if (r.name) names[r.seat] = r.name;
    return (
      <WinScreen
        board={board}
        crossed={state.crossed}
        pattern={round.pattern}
        winners={state.ended.winners}
        wonByMe={state.ended.wonByMe}
        names={names}
        labelLang={labelLang}
        onAnother={() => dispatch({ type: 'dismissEnded' })}
        onBack={() => {
          dispatch({ type: 'dismissEnded' });
          onBackToLobby?.();
        }}
      />
    );
  }

  const cells: CellData[] = board.map((id, i) => ({
    id,
    emoji: emoji(id),
    label: label(id, labelLang),
    marked: state.crossed.includes(id),
    winning: set?.includes(i) ?? false,
  }));
  const onBoard = !!cur && board.includes(cur.cardId);
  const callWord = cur ? (nameOf(cur.cardId, cur.lang) ?? label(cur.cardId, 'es')) : '';
  const callReview = cur && !hidden && inReview(cur.cardId, cur.lang) ? 'word' : undefined;
  const crossedNow = !!cur && state.crossed.includes(cur.cardId);
  const points = state.points[transport.seat] ?? 0;
  const patternName = round ? t(`player.patternNames.${round.pattern}`) : '';

  let feedback: { tone: 'neutral' | 'ok' | 'casi'; title: string; text: string };
  if (state.feedback?.kind === 'casi')
    feedback = {
      tone: 'casi',
      title: t('player.feedbackCasi'),
      text: t('player.feedbackCasiHint'),
    };
  else if (state.feedback?.kind === 'ok' && cur)
    feedback = {
      tone: 'ok',
      title: state.feedback.first ? t('player.feedbackFirst') : t('player.feedbackOk'),
      text: t('player.feedbackOkHint', {
        word: callWord,
        gloss: label(cur.cardId, labelLang === 'en' ? 'en' : 'es'),
      }),
    };
  else if (state.currentExpired && onBoard && !crossedNow)
    feedback = { tone: 'neutral', title: t('player.timeUp'), text: t('player.timeUpHint') };
  else
    feedback = {
      tone: 'neutral',
      title: t('player.feedbackIdle'),
      text: t('player.feedbackIdleHint'),
    };

  return (
    <main id="main" className={styles.root} style={{ fontSize: `${TEXT_SCALES[scaleIdx]}%` }}>
      <div className={styles.content} inert={modalOpen}>
        <header className={styles.bar}>
          <span className={styles.code}>{code}</span>
          <span className={styles.cardNo}>{cur ? t('player.cardOf', { n: cur.i + 1 }) : ''}</span>
          <span className={styles.barEnd}>
            {cur ? (
              <Pill tone={cur.lang as PillTone}>{langName(cur.lang)}</Pill>
            ) : (
              <Pill tone={labelLang as PillTone}>{langName(labelLang)}</Pill>
            )}
          </span>
        </header>

        <p className={styles.conn} role="status" data-state={lost ? 'lost' : 'connected'}>
          <span aria-hidden="true">{lost ? '▲' : '●'}</span>{' '}
          {lost ? t('player.connectionLost') : t('player.connected')}
          {roster && roster.length > 0 ? (
            <> · {t('lobby.count', { count: roster.length })}</>
          ) : null}
          {!room.hostVerified ? <> · {t('player.unverifiedBadge')}</> : null}
        </p>

        {!round ? (
          <p className={styles.waiting}>{t('player.waitingRound')}</p>
        ) : board.length === 0 ? (
          <p className={styles.waiting} role="status">
            {t('player.preparing')}
          </p>
        ) : (
          <>
            <div data-testid="call" aria-live="polite" aria-atomic="true">
              {cur ? (
                <CallPanel
                  word={callWord}
                  listening={hidden}
                  review={callReview}
                  progress={Math.min(1, Math.max(0, progress))}
                  onReplay={() => speak(cur.cardId, cur.lang)}
                />
              ) : (
                <Panel variant="dashed" className={styles.idle}>
                  <span>{t('player.waitingCall')}</span>
                </Panel>
              )}
            </div>

            {cur && !onBoard ? (
              <Panel variant="dashed" className={styles.off} aria-labelledby="off-title">
                <svg
                  aria-hidden="true"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <path d="M9 9l6 6M15 9l-6 6" />
                </svg>
                <span id="off-title" className={styles.offTitle}>
                  {t('player.offBoard')}
                </span>
                <span className={styles.offText}>{t('player.offBoardHint')}</span>
              </Panel>
            ) : cur ? (
              <section aria-labelledby="which" className={styles.choices}>
                <h2 id="which" className={styles.h2}>
                  {t('player.whichOne')}
                </h2>
                <div className={styles.choiceRow}>
                  {cur.choices.map((id) => {
                    const wrong = state.wrong.includes(id);
                    const right = crossedNow && id === cur.cardId;
                    return (
                      <ChoiceTile
                        key={id}
                        id={id}
                        emoji={emoji(id)}
                        label={label(id, labelLang)}
                        state={right ? 'correct' : wrong ? 'wrong' : 'idle'}
                        disabled={crossedNow || state.currentExpired || state.pickPending}
                        onChoose={() => pick(id)}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            <FeedbackStrip tone={feedback.tone} title={feedback.title}>
              {feedback.text}
            </FeedbackStrip>

            <section aria-labelledby="tabla-h" className={styles.tabla}>
              <div className={styles.tablaHead}>
                <h2 id="tabla-h" className={styles.h3}>
                  {t('player.tablaTitle')} · {patternName}
                </h2>
                <span title={t('player.pointsTip')}>
                  <Pill tone="paper">
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="var(--color-maiz)"
                      stroke="var(--color-ink)"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                    </svg>
                    {t('player.points', { count: points })}
                  </Pill>
                </span>
              </div>
              <Tabla cells={cells} label={t('player.tablaTitle')} />
            </section>

            {set && (
              <div ref={claimWrap}>
                <Button
                  className={styles.claim}
                  onClick={claim}
                  disabled={!canPress || state.ended !== null}
                  aria-describedby="claim-status"
                >
                  {t('player.claim')}
                </Button>
              </div>
            )}
            <p id="claim-status" className={styles.muted} role="status">
              {state.claimPending
                ? t('player.claimSent')
                : state.claimNoReply
                  ? t('player.claimNoReply')
                  : ''}
            </p>

            <details className={styles.settings}>
              <summary>{t('player.settings')}</summary>
              <div className={styles.tools}>
                <button
                  type="button"
                  onClick={() => setScaleIdx((i) => Math.max(0, i - 1))}
                  disabled={scaleIdx === 0}
                  aria-label={t('player.textSmaller')}
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => setScaleIdx((i) => Math.min(TEXT_SCALES.length - 1, i + 1))}
                  disabled={scaleIdx === TEXT_SCALES.length - 1}
                  aria-label={t('player.textLarger')}
                >
                  A+
                </button>
                <button
                  type="button"
                  aria-pressed={contrast}
                  onClick={() => setContrast((c) => !c)}
                >
                  {t('player.highContrast')}
                </button>
              </div>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={state.autoMark}
                  onChange={(e) => dispatch({ type: 'setAutoMark', on: e.target.checked })}
                />
                {t('player.autoMark')}
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={state.listenOnly}
                  onChange={(e) => dispatch({ type: 'setListenOnly', on: e.target.checked })}
                />
                {t('player.listenOnly')}
              </label>
              <p className={styles.muted}>
                {t('player.cardsCalled', { count: state.calledSoFar.length })}
              </p>
            </details>
          </>
        )}
      </div>

      {showResult && state.claimResult && !state.claimResult.valid && (
        <Modal labelId="almost-title" onClose={() => dispatch({ type: 'dismissResult' })}>
          <h2 id="almost-title">{t('lotto.almost')}</h2>
          <p>{t('lotto.almostHint')}</p>
          {missingText && <p>{t('player.almostMissing', { cards: missingText })}</p>}
          <Button autoFocus onClick={() => dispatch({ type: 'dismissResult' })}>
            {t('player.gotIt')}
          </Button>
        </Modal>
      )}
      {showResult && state.claimResult?.valid && (
        <Modal celebrate labelId="yay-title" onClose={() => dispatch({ type: 'dismissResult' })}>
          <h2 id="yay-title">{t('lotto.shout')}</h2>
          <p>{t('player.celebrate')}</p>
          <Button autoFocus onClick={() => dispatch({ type: 'dismissResult' })}>
            {t('player.gotIt')}
          </Button>
        </Modal>
      )}
    </main>
  );
}
