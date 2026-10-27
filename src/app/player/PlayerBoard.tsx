import { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardId, Lang } from '@engine';
import { getCard } from '@content';
import type { Msg, Transport } from '@net';
import type { MessageLog } from '../lobby/messageLog';
import { isMuted, onMutedChange, setMuted, speakCall } from '../audio';
import {
  Button,
  CardArt,
  FeedbackStrip,
  Panel,
  Pill,
  ProgressBar,
  Tabla,
  type CellData,
  type PillTone,
} from '../ui';
import WinScreen from './WinScreen';
import SettingsSheet from './SettingsSheet';
import PrintBoardButton from './PrintBoardButton';
import UiLangSwitch from './UiLangSwitch';
import { patchLocalProfile } from './profile';
import { emojiOf, wordOf } from './words';
import { initialPlayerState, playerReducer } from './playerState';
import styles from './PlayerBoard.module.css';

export interface PlayerProfile {
  name: string;
  glyph: string;
  pronouns?: string;
  /** The language I hear and read my words in (nah, yua, quz, es, en). */
  spokenLang: Lang;
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
  const [tick, setTick] = useState(() => Date.now());
  const [spokenLang, setSpokenLang] = useState<Lang>(profile.spokenLang);
  const [sheet, setSheet] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
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
  const { name } = profile;

  useEffect(() => onMutedChange(setMutedState), []);

  useEffect(() => {
    const handle = (m: Msg) => {
      switch (m.t) {
        case 'round':
          dispatch({
            type: 'round',
            round: { roomSeed: m.seed, roundNo: m.roundNo, speedSec: m.speedSec },
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
            i: m.i,
            now: Date.now(),
          });
          break;
        case 'callClosed':
          dispatch({ type: 'callClosed', roundNo: m.roundNo, i: m.i });
          break;
        case 'pickResult':
          if (m.seat === transport.seat)
            dispatch({
              type: 'pickResult',
              roundNo: m.roundNo,
              i: m.i,
              correct: m.correct,
              points: m.points,
              first: m.first,
            });
          break;
        case 'scores':
          dispatch({ type: 'scores', roundNo: m.roundNo, points: m.points });
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

  const cur = state.current;
  const round = state.round;
  const board = state.board;

  // Play each new call in MY spoken language; the speaker button replays it.
  const speak = useCallback((cardId: CardId, lang: Lang) => {
    const card = getCard(cardId);
    if (!card) return;
    try {
      void speakCall(card, lang).catch(() => undefined);
    } catch {
      /* no audio available */
    }
  }, []);
  const curKey = cur ? `${cur.i}:${cur.cardId}` : '';
  useEffect(() => {
    if (cur) speak(cur.cardId, spokenLang);
    // Only when a different call arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey, speak]);

  // Timer bar: local receive time plus the round's speed.
  const speedMs = (round?.speedSec ?? 8) * 1000;
  const open = !!cur && !state.currentClosed;
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [open]);
  const progress = cur ? (state.currentClosed ? 1 : (tick - cur.receivedAt) / speedMs) : 0;

  const pick = (cardId: CardId) => {
    const c = state.current;
    if (!c || !state.round) return;
    if (state.currentClosed || state.solved || state.pickPending || state.wrong.length >= 2) return;
    if (state.wrong.includes(cardId)) return;
    dispatch({ type: 'pick', cardId });
    transport.send({
      t: 'pick',
      seat: transport.seat,
      roundNo: state.round.roundNo,
      i: c.i,
      cardId,
    });
  };

  const changeSpoken = (l: Lang) => {
    setSpokenLang(l);
    patchLocalProfile({ spokenLang: l });
  };

  const langName = (l: Lang) => t(`lobby.langs.${l}.name`);
  const points = state.points[transport.seat] ?? state.myPoints;
  const endedOpen = state.ended !== null && !state.ended.dismissed;

  if (endedOpen && state.ended && round && board.length > 0) {
    const names: Record<string, string> = { [transport.seat]: name };
    for (const r of roster ?? []) if (r.name) names[r.seat] = r.name;
    return (
      <WinScreen
        board={board}
        crossed={state.crossed}
        winners={state.ended.winners}
        wonByMe={state.ended.wonByMe}
        names={names}
        points={{ ...state.points, [transport.seat]: points }}
        spokenLang={spokenLang}
        onAnother={() => dispatch({ type: 'dismissEnded' })}
        onBack={() => {
          dispatch({ type: 'dismissEnded' });
          onBackToLobby?.();
        }}
      />
    );
  }

  // Icons only until the card's call has closed; then the word under the icon.
  const cells: CellData[] = board.map((id) => ({
    id,
    emoji: emojiOf(id),
    label: state.revealed.includes(id) ? wordOf(id, spokenLang) : '',
    marked: state.crossed.includes(id),
  }));

  let feedback: { tone: 'neutral' | 'ok' | 'casi'; title: string; text: string };
  if (state.feedback?.kind === 'casi')
    feedback = {
      tone: 'casi',
      title: t('player.feedbackCasi'),
      text: state.wrong.length >= 2 ? t('player.feedbackCasiLast') : t('player.feedbackCasiHint'),
    };
  else if (state.feedback?.kind === 'ok')
    feedback = {
      tone: 'ok',
      title: state.feedback.points === 2 ? t('player.feedbackFirst') : t('player.feedbackOk'),
      text: t('player.feedbackOkHint'),
    };
  else if (state.currentClosed && cur)
    feedback = { tone: 'neutral', title: t('player.timeUp'), text: t('player.timeUpHint') };
  else
    feedback = {
      tone: 'neutral',
      title: t('player.feedbackIdle'),
      text: t('player.feedbackIdleHint'),
    };

  const choiceDisabled = (id: CardId) =>
    state.currentClosed ||
    state.solved ||
    state.pickPending ||
    state.wrong.includes(id) ||
    state.wrong.length >= 2;

  return (
    <main id="main" className={styles.root} style={{ fontSize: `${TEXT_SCALES[scaleIdx]}%` }}>
      <div className={styles.content} inert={sheet}>
        <header className={styles.bar}>
          <span className={styles.code}>{code}</span>
          <span className={styles.cardNo}>{cur ? t('player.cardOf', { n: cur.i + 1 }) : ''}</span>
          <span className={styles.barEnd}>
            <UiLangSwitch />
            <Pill tone={spokenLang as PillTone}>{langName(spokenLang)}</Pill>
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
            {/* Announces a call without its spelling. */}
            <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announce">
              {cur ? t('player.newCard', { n: cur.i + 1 }) : ''}
            </p>

            <div data-testid="call">
              {cur ? (
                <Panel className={styles.call}>
                  <div className={styles.picture} role="img" aria-label={t('player.callPicture')}>
                    <CardArt
                      id={cur.cardId}
                      emoji={emojiOf(cur.cardId)}
                      className={styles.pictureArt}
                    />
                  </div>
                  <div className={styles.callTools}>
                    <button
                      type="button"
                      className={styles.tool}
                      onClick={() => speak(cur.cardId, spokenLang)}
                      aria-label={t('player.replay')}
                    >
                      <svg
                        aria-hidden="true"
                        width="26"
                        height="26"
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
                    <button
                      type="button"
                      className={styles.tool}
                      aria-pressed={muted}
                      onClick={() => setMuted(!muted)}
                      aria-label={muted ? t('player.unmute') : t('player.mute')}
                    >
                      <svg
                        aria-hidden="true"
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 9v6h4l5 4V5L8 9H4z" />
                        {muted ? (
                          <path d="M17 9l5 6M22 9l-5 6" />
                        ) : (
                          <path d="M16.5 8.5a5 5 0 010 7" />
                        )}
                      </svg>
                    </button>
                    <span className={styles.ai}>{t('player.aiVoice')}</span>
                  </div>
                  <div className={styles.timer}>
                    <ProgressBar
                      value={Math.min(1, Math.max(0, progress))}
                      label={t('theme.kit.progress')}
                    />
                  </div>
                  {state.currentClosed ? (
                    <p className={styles.closedWord}>
                      {t('player.closedWord', { word: wordOf(cur.cardId, spokenLang) })}
                    </p>
                  ) : null}
                </Panel>
              ) : (
                <Panel variant="dashed" className={styles.idle}>
                  <span>{t('player.waitingCall')}</span>
                </Panel>
              )}
            </div>

            {cur ? (
              <section aria-labelledby="which" className={styles.choices}>
                <h2 id="which" className={styles.h2}>
                  {t('player.whichOne')}
                </h2>
                <div className={styles.choiceRow}>
                  {cur.choices.map((id) => {
                    const wrong = state.wrong.includes(id);
                    const right = state.solved && id === cur.cardId;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={styles.choice}
                        data-state={right ? 'correct' : wrong ? 'wrong' : 'idle'}
                        disabled={choiceDisabled(id)}
                        lang={spokenLang}
                        onClick={() => pick(id)}
                      >
                        {wordOf(id, spokenLang)}
                      </button>
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
                  {t('player.tablaTitle')}
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
                    <span data-testid="points">{t('player.points', { count: points })}</span>
                  </Pill>
                </span>
              </div>
              <p className="sr-only">
                {t('player.tablaSummary', {
                  revealed: state.revealed.filter((id) => board.includes(id)).length,
                  crossed: state.crossed.length,
                })}
              </p>
              <Tabla cells={cells} label={t('player.tablaTitle')} />
            </section>

            <p className={styles.muted}>
              {t('player.cardsCalled', { count: state.revealed.length + (open ? 1 : 0) })}
            </p>
          </>
        )}

        {round && state.assign && board.length > 0 ? (
          <PrintBoardButton
            seed={round.roomSeed}
            tablaIndex={state.assign.tablaIndex}
            name={name}
            code={code}
            spokenLang={spokenLang}
          />
        ) : null}

        <Button variant="link" onClick={() => setSheet(true)} aria-haspopup="dialog">
          {t('player.settings')}
        </Button>
      </div>

      {sheet && (
        <SettingsSheet
          print={
            round && state.assign && board.length > 0
              ? {
                  seed: round.roomSeed,
                  tablaIndex: state.assign.tablaIndex,
                  name,
                  code,
                }
              : undefined
          }
          spokenLang={spokenLang}
          onSpokenLang={changeSpoken}
          muted={muted}
          onMuted={setMuted}
          canShrink={scaleIdx > 0}
          canGrow={scaleIdx < TEXT_SCALES.length - 1}
          onSmaller={() => setScaleIdx((i) => Math.max(0, i - 1))}
          onLarger={() => setScaleIdx((i) => Math.min(TEXT_SCALES.length - 1, i + 1))}
          contrast={contrast}
          onContrast={() => setContrast((c) => !c)}
          onClose={() => setSheet(false)}
        />
      )}
    </main>
  );
}
