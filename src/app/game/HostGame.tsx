import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cardName, getCard } from '@content';
import { isMuted, onMutedChange, setMuted } from '../audio';
import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS } from '../host/roundMachine';
import { useGame } from '../host/useGame';
import { LOCAL_SEAT } from '../host/useHostRoom';
import type { GameProps } from '../host/useGame';
import {
  Button,
  CardArt,
  FeedbackStrip,
  HistoryStrip,
  Leaderboard,
  Panel,
  PaperCard,
  Pill,
  ProgressBar,
  QrCard,
  Tabla,
} from '../ui';
import type { CellData } from '../ui';
import { emojiOf, wordOf } from '../player/words';
import styles from './HostGame.module.css';

function useMuted(): boolean {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMutedChange(setM), []);
  return m;
}

/** The host screen is silent by default: players hear the word in their own language. */
function useHostSilent(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const was = isMuted();
    setMuted(true);
    return () => setMuted(was);
  }, [enabled]);
}

function speedLabelKey(sec: number): 'calm' | 'normal' | 'fast' | null {
  for (const k of ['calm', 'normal', 'fast'] as const) if (SPEED_PRESETS[k] === sec) return k;
  return null;
}

/**
 * Game boundary (docs/rules.md): the automatic caller screen. The device that creates the
 * room runs it and holds no tabla. Props: { transport, room, roster } plus onNewRound.
 */
export default function HostGame(props: GameProps) {
  const { t } = useTranslation();
  const h = useGame(props);
  const { state } = h;
  const { room, roster } = props;
  const play = h.local;
  const muted = useMuted();
  useHostSilent(!play);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [qrOpen, setQrOpen] = useState(
    () => typeof window === 'undefined' || !window.matchMedia?.('(max-width: 767px)').matches,
  );
  const nameOf = (id: string) => {
    const c = getCard(id);
    return c ? (cardName(c, 'es')?.text ?? c.id) : id;
  };
  const who = (seat: string) => {
    const p = roster.find((r) => r.seat === seat);
    return p ? `${p.glyph} ${p.name}` : (h.names[seat] ?? t('host.unknownPlayer'));
  };

  const live = state.phase === 'running' || state.phase === 'paused';
  const ended = state.phase === 'ended';
  const running = state.phase === 'running';
  const connection = room.connection ?? 'online';
  const speedKey = speedLabelKey(state.settings.speedSec);
  const speedText = `${speedKey ? t(`host.speeds.${speedKey}`) : t('host.speed')} · ${t('host.game.seconds', { s: state.settings.speedSec })}`;

  // Countdown ticker (UI only; the caller timer lives in useGame).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  const elapsed = running ? Math.max(0, now - h.windowStart) : 0;
  const total = state.settings.speedSec * 1000;
  const remainingSec = Math.max(0, Math.ceil((total - elapsed) / 1000));
  const pct = running ? Math.max(0, Math.min(100, 100 - (elapsed / total) * 100)) : 100;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (el?.isContentEditable || el?.closest?.('[contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if (!live) return;
      if (e.key === ' ') {
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault();
        h.togglePause();
      } else if (k === 'p') h.togglePause();
      else if (k === 'r') h.repeat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const card = h.current;
  const revealed = ended ? h.called : h.called.slice(0, -1);
  const history = [...revealed].reverse().flatMap((id) => {
    const c = getCard(id);
    return c ? [{ id, emoji: c.art, label: nameOf(id) }] : [];
  });
  const gridCells = state.settings.gridSize * state.settings.gridSize;

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logo} src="/favicon.svg" alt="" width={44} height={44} />
          <span className={styles.brandName}>
            {t('app.name', { defaultValue: 'Lotería de los Pueblos' })}
          </span>
        </div>
        <div className={styles.controls}>
          {live ? (
            <Button variant="secondary" fit onClick={h.togglePause}>
              {running ? t('host.pause') : t('host.resume')}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            fit
            aria-expanded={speedOpen}
            aria-controls="speed-panel"
            onClick={() => setSpeedOpen((o) => !o)}
          >
            {speedText}
          </Button>
          <Pill tone="jade">{t('host.game.auto')}</Pill>
        </div>
        {speedOpen ? (
          <Panel id="speed-panel" className={styles.speedPanel}>
            <div className={styles.row}>
              {(['calm', 'normal', 'fast'] as const).map((k) => (
                <Button
                  key={k}
                  variant="secondary"
                  fit
                  aria-pressed={state.settings.speedSec === SPEED_PRESETS[k]}
                  onClick={() => h.setSpeed(SPEED_PRESETS[k])}
                >
                  {t(`host.speeds.${k}`)} · {t('host.game.seconds', { s: SPEED_PRESETS[k] })}
                </Button>
              ))}
            </div>
            <label className={styles.sliderLabel}>
              <span>{t('host.speedSlider')}</span>
              <input
                type="range"
                className={styles.range}
                min={MIN_SPEED}
                max={MAX_SPEED}
                value={state.settings.speedSec}
                aria-valuetext={t('host.speedSeconds', { seconds: state.settings.speedSec })}
                onChange={(e) => h.setSpeed(Number(e.target.value))}
              />
            </label>
          </Panel>
        ) : null}
      </header>

      {connection === 'unverified' || connection === 'offline' ? (
        <p className={styles.notice} role="status">
          {connection === 'offline' ? t('host.offlineOk') : t('host.unverifiedRoom')}{' '}
          <Link className={styles.link} to={`/print?seed=${state.roomSeed}`}>
            {t('host.printLink')}
          </Link>
        </p>
      ) : null}

      {/* a11y: announces each called card (and repeats; keyed by call sequence) */}
      <div key={h.announcement.seq} aria-live="polite" className={styles.srOnly}>
        {h.announcement.text ? t('a11y.called', { card: h.announcement.text }) : ''}
      </div>

      <div className={styles.layout} data-play={play ? '' : undefined}>
        <section className={styles.main} aria-labelledby="cur-h">
          <h2 id="cur-h" className={styles.callTitle}>
            <span className={styles.callNo}>{t('host.game.cardNo', { n: state.calledCount })}</span>
            <span className={styles.callOf}>
              {t('host.game.ofTotal', { total: state.order.length || 54 })}
            </span>
          </h2>

          {ended ? (
            <PaperCard size="lg" className={styles.endPanel}>
              <p className={styles.endTitle}>
                {state.winners.length ? t('host.celebrate') : t('host.ended')}
              </p>
              {state.winners.length ? (
                <>
                  <p>{t('host.game.fullCard')}</p>
                  <h3>{t('host.winners')}</h3>
                  <ul className={styles.winners}>
                    {state.winners.map((s) => (
                      <li key={s}>{who(s)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{t('host.noWinners')}</p>
              )}
              <Leaderboard
                entries={h.standings}
                selfSeat={play ? LOCAL_SEAT : undefined}
                total={gridCells}
                label={t('host.game.finalStandings')}
              />
              <Button variant="primary" onClick={h.newRound}>
                {t('host.newRound')}
              </Button>
            </PaperCard>
          ) : card ? (
            <>
              <figure className={`${styles.picture} ${play ? styles.compact : ''}`}>
                <CardArt id={card.id} emoji={card.art} className={styles.pictureArt} />
                <figcaption className={styles.srOnly}>{t('host.game.picture')}</figcaption>
              </figure>
              {h.noAudio ? <p className={styles.notice}>{t('host.noRecordingYet')}</p> : null}
              <div className={styles.timer}>
                <span className={styles.timerLabel}>{t('host.game.time')}</span>
                <div className={styles.timerBar}>
                  <ProgressBar value={pct / 100} label={t('host.game.time')} />
                </div>
                <span className={styles.timerNum} role="timer" aria-live="off">
                  {running ? t('host.game.seconds', { s: remainingSec }) : t('host.paused')}
                </span>
              </div>
            </>
          ) : null}

          {!ended ? (
            <div className={styles.row}>
              <Button variant="secondary" fit onClick={h.repeat}>
                {t('host.repeat')}
              </Button>
              <Button variant="secondary" fit aria-pressed={muted} onClick={() => setMuted(!muted)}>
                {muted ? t('host.unmute') : t('host.mute')}
              </Button>
            </div>
          ) : null}
          {play ? (
            <p className={styles.panelTitle} role="status">
              {t('host.game.pickers', { x: h.pickedCount, y: h.eligibleCount })}
            </p>
          ) : null}
          <p className={`${styles.sub} ${styles.hint}`}>{t('host.game.shortcuts')}</p>
        </section>

        {play ? (
          <section className={styles.play} aria-labelledby="play-h">
            <h2 id="play-h" className={styles.panelH}>
              {t('host.game.yourBoard')}
            </h2>
            <div className={styles.row}>
              <span className={styles.youPoints} aria-live="polite">
                {t('host.game.youPoints', { n: play.points })}
              </span>
              <span className={styles.sub}>
                {t('host.game.squaresLeft', { n: play.squaresLeft })}
              </span>
            </div>
            <div className={styles.choices} role="group" aria-label={t('host.game.choices')}>
              {play.choices.map((id) => {
                const wrong = play.wrong.includes(id);
                const right = play.callPoints > 0 && id === h.current?.id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={styles.choice}
                    data-state={right ? 'correct' : wrong ? 'wrong' : 'idle'}
                    aria-label={
                      wrong && !right
                        ? `${wordOf(id, room.local?.spokenLang ?? 'es')} · ${t('theme.kit.wrong')}`
                        : undefined
                    }
                    disabled={
                      !running || ended || play.callPoints > 0 || wrong || play.picksUsed >= 2
                    }
                    onClick={() => play.pick(id)}
                  >
                    {wordOf(id, room.local?.spokenLang ?? 'es')}
                    {wrong && !right ? (
                      <svg
                        className={styles.wrongMark}
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <FeedbackStrip
              tone={play.callPoints > 0 ? 'ok' : play.wrong.length > 0 ? 'casi' : 'neutral'}
              title={
                play.callPoints > 0
                  ? t(play.callPoints === 2 ? 'host.game.okFirst' : 'host.game.okOther')
                  : play.wrong.length > 0
                    ? t('host.game.casi')
                    : running
                      ? t('host.game.listen')
                      : t('host.paused')
              }
            >
              {play.callPoints === 0 && play.wrong.length === 1
                ? t('host.game.casiText')
                : undefined}
            </FeedbackStrip>
            <Tabla
              label={t('host.game.yourBoard')}
              cells={play.cards.map<CellData>((id) => {
                const marked = play.crossed.includes(id);
                return {
                  id,
                  emoji: emojiOf(id),
                  label: marked ? wordOf(id, room.local?.spokenLang ?? 'es') : '',
                  marked,
                };
              })}
            />
          </section>
        ) : null}

        <aside className={styles.side}>
          {play ? (
            <details
              className={styles.qrDetails}
              open={qrOpen}
              onToggle={(e) => setQrOpen(e.currentTarget.open)}
            >
              <summary className={styles.qrSummary}>{t('host.game.roomCode')}</summary>
              <QrCard url={room.joinUrl ?? ''} code={room.code} />
            </details>
          ) : (
            <QrCard url={room.joinUrl ?? ''} code={room.code} />
          )}
          {play ? null : (
            <Panel>
              <p className={styles.panelTitle} role="status">
                {t('host.game.pickers', { x: h.pickedCount, y: h.eligibleCount })}
              </p>
              <ProgressBar
                tone="jade"
                value={h.eligibleCount ? h.pickedCount / h.eligibleCount : 0}
                label={t('host.game.pickers', { x: h.pickedCount, y: h.eligibleCount })}
              />
              <span className={styles.sub}>{t('host.game.phones', { count: roster.length })}</span>
            </Panel>
          )}
          {ended ? null : (
            <Panel as="section" aria-labelledby="pts">
              <div className={styles.panelHead}>
                <h2 id="pts" className={styles.panelH}>
                  {t('host.game.points')}
                </h2>
                <span className={styles.sub}>{t('host.game.tiebreak')}</span>
              </div>
              <Leaderboard
                scroll
                entries={h.standings}
                selfSeat={play ? LOCAL_SEAT : undefined}
                total={gridCells}
              />
              <span className={styles.sub}>{t('host.game.firstPlus', { n: 2 })}</span>
            </Panel>
          )}
        </aside>

        <footer className={styles.history}>
          <HistoryStrip items={history} title={t('host.game.history')} />
        </footer>
      </div>
    </main>
  );
}
