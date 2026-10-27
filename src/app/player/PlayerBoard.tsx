import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardId, Lang } from '@engine';
import { cardName, getCard } from '@content';
import type { Msg, Transport } from '@net';
import type { MessageLog } from '../lobby/messageLog';
import { matcherProvider } from '@ai';
import { canClaim, initialPlayerState, playerReducer, CLAIM_REPLY_TIMEOUT_MS } from './playerState';
import styles from './PlayerBoard.module.css';

export interface PlayerProfile {
  name: string;
  glyph: string;
  pronouns?: string;
  labelLang: Lang;
}

export interface PlayerBoardProps {
  transport: Transport;
  room: { code: string; seat: string; hostVerified: boolean };
  roster?: { seat: string }[];
  profile: PlayerProfile;
  /** Lobby message buffer; when absent the board listens to the transport directly. */
  log?: MessageLog;
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

export default function PlayerBoard({ transport, room, roster, profile, log }: PlayerBoardProps) {
  const { t } = useTranslation();
  const { code } = room;
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const [lost, setLost] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  const [hint, setHint] = useState<{ cardId: CardId | null } | null>(null);
  const claimBtn = useRef<HTMLButtonElement>(null);
  const wasModal = useRef(false);
  const { name, glyph, labelLang } = profile;

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
            },
            called: m.called,
            marks: loadMarks(code, m.seed, m.roundNo),
          });
          break;
        case 'assign':
          if (m.seat === transport.seat)
            dispatch({ type: 'assign', tablaIndex: m.tablaIndex, roundNo: m.roundNo });
          break;
        case 'call':
          dispatch({ type: 'call', cardId: m.cardId, lang: m.lang, i: m.i });
          setHint(null);
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
        JSON.stringify(state.marks),
      );
    } catch {
      /* ignore */
    }
  }, [code, state.round, state.board, state.marks]);

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
      marks: state.marks,
    });
  }, [state, transport]);

  const curId = state.current?.cardId;
  const audioOnly = state.round?.mode === 'escucha';
  const boardCards = state.board;
  const askHint = useCallback(async () => {
    const r = await matcherProvider.pick({ cardId: curId, audioOnly }, boardCards);
    setHint({ cardId: r.cardId && r.confidence >= 0.6 ? r.cardId : null });
  }, [curId, audioOnly, boardCards]);

  const { round, board, current } = state;
  const hidden = round?.mode === 'escucha' || state.listenOnly;
  const cooling = !canClaim(state, now) && board.length > 0 && state.ended === null;
  const showResult = state.claimResult !== null;
  const showEnded = !showResult && state.ended !== null && !state.ended.dismissed;
  const modalOpen = showResult || showEnded;

  useEffect(() => {
    if (wasModal.current && !modalOpen) claimBtn.current?.focus();
    wasModal.current = modalOpen;
  }, [modalOpen]);

  const missingText = (state.claimResult?.missing ?? [])
    .slice(0, 4)
    .map((id) => label(id, labelLang))
    .join(', ');

  return (
    <main id="main" className={styles.root} style={{ fontSize: `${TEXT_SCALES[scaleIdx]}%` }}>
      <div className={styles.content} inert={modalOpen}>
        <header className={styles.bar}>
          <span className={styles.who}>
            <span aria-hidden="true">{glyph}</span> {name}
            {roster && roster.length > 0 && (
              <small className={styles.status}>
                {' '}
                · {t('lobby.count', { count: roster.length })}
              </small>
            )}
          </span>
          <span className={styles.status} role="status" data-state={lost ? 'lost' : 'connected'}>
            <span aria-hidden="true">{lost ? '▲' : '●'}</span>{' '}
            {lost ? t('player.connectionLost') : t('player.connected')}
          </span>
        </header>

        {!room.hostVerified && (
          <p className={styles.notice} role="note">
            {t('player.unverifiedBadge')}. {t('host.unverifiedRoom')}
          </p>
        )}

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
          <button type="button" aria-pressed={contrast} onClick={() => setContrast((c) => !c)}>
            {t('player.highContrast')}
          </button>
        </div>

        {!round ? (
          <p className={styles.waiting}>{t('player.waitingRound')}</p>
        ) : board.length === 0 ? (
          <p className={styles.waiting} role="status">
            {t('player.preparing')}
          </p>
        ) : (
          <>
            <div className={styles.call} data-testid="call" aria-live="polite" aria-atomic="true">
              {hidden ? (
                <>
                  <p className={styles.callWord}>{t('player.listening')}</p>
                  <p className={styles.muted}>{t('player.listeningHint')}</p>
                </>
              ) : current ? (
                <>
                  <p className={styles.callEmoji} aria-hidden="true">
                    {emoji(current.cardId)}
                  </p>
                  <p className={styles.callWord}>{label(current.cardId, current.lang)}</p>
                </>
              ) : (
                <p className={styles.muted}>{t('player.currentCall')}…</p>
              )}
            </div>
            <p className={styles.muted}>
              {t('player.cardsCalled', { count: state.calledSoFar.length })}
            </p>

            <ul className={styles.grid} aria-label={t('player.title')}>
              {board.map((id) => {
                const marked = state.marks.includes(id);
                const cardLabel = label(id, labelLang);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={styles.cell}
                      data-marked={marked}
                      data-hint={hint?.cardId === id}
                      aria-pressed={marked}
                      aria-label={
                        marked
                          ? t('player.unmarkCard', { card: cardLabel })
                          : t('player.markCard', { card: cardLabel })
                      }
                      onClick={() => dispatch({ type: 'toggleMark', cardId: id })}
                    >
                      <span className={styles.cellEmoji} aria-hidden="true">
                        {emoji(id)}
                      </span>
                      <span className={styles.cellName}>{cardLabel}</span>
                      {marked && (
                        <span className={styles.bean} aria-hidden="true">
                          ●
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className={styles.row}>
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
            </div>

            <div className={styles.row}>
              <button type="button" className={styles.secondary} onClick={() => void askHint()}>
                {t('player.hint')}
              </button>
              {hint && (
                <p className={styles.muted} role="status">
                  {!current
                    ? t('player.hintNeedsCall')
                    : hint.cardId
                      ? t('player.hintOnBoard')
                      : t('player.hintNotOnBoard')}
                </p>
              )}
            </div>

            <button
              ref={claimBtn}
              type="button"
              className={styles.claim}
              onClick={claim}
              disabled={cooling || state.ended !== null}
              aria-describedby="claim-status"
            >
              {t('player.claim')}
            </button>
            <p id="claim-status" className={styles.muted} role="status">
              {state.claimPending
                ? t('player.claimSent')
                : state.claimNoReply
                  ? t('player.claimNoReply')
                  : ''}
            </p>
          </>
        )}
      </div>

      {showResult && state.claimResult && !state.claimResult.valid && (
        <Modal labelId="almost-title" onClose={() => dispatch({ type: 'dismissResult' })}>
          <h2 id="almost-title">{t('lotto.almost')}</h2>
          <p>{t('lotto.almostHint')}</p>
          {missingText && <p>{t('player.almostMissing', { cards: missingText })}</p>}
          <button type="button" autoFocus onClick={() => dispatch({ type: 'dismissResult' })}>
            {t('player.gotIt')}
          </button>
        </Modal>
      )}
      {showResult && state.claimResult?.valid && (
        <Modal celebrate labelId="yay-title" onClose={() => dispatch({ type: 'dismissResult' })}>
          <h2 id="yay-title">
            <span aria-hidden="true" className={styles.party}>
              🎉
            </span>{' '}
            {t('lotto.shout')}
          </h2>
          <p>{t('player.celebrate')}</p>
          <button type="button" autoFocus onClick={() => dispatch({ type: 'dismissResult' })}>
            {t('player.gotIt')}
          </button>
        </Modal>
      )}
      {showEnded && state.ended && (
        <Modal labelId="end-title" onClose={() => dispatch({ type: 'dismissEnded' })}>
          <h2 id="end-title">{t('player.roundEnded')}</h2>
          {state.ended.wonByMe ? (
            <p>{t('player.youCalled')}</p>
          ) : state.ended.winners.length > 0 ? (
            <p>{t('player.someoneCalled')}</p>
          ) : null}
          <button type="button" autoFocus onClick={() => dispatch({ type: 'dismissEnded' })}>
            {t('player.gotIt')}
          </button>
        </Modal>
      )}
    </main>
  );
}
