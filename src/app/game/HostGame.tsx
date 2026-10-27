import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cardName, getCard } from '@content';
import type { Lang } from '@engine';
import { isMuted, onMutedChange, setMuted } from '../audio';
import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS } from '../host/roundMachine';
import { useGame } from '../host/useGame';
import type { Game, GameProps } from '../host/useGame';
import { useModal } from '../host/useModal';
import { Button, HistoryStrip, Panel, PaperCard, Pill, ProgressBar, QrCard, WordCard } from '../ui';
import styles from './HostGame.module.css';

function useMuted(): boolean {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMutedChange(setM), []);
  return m;
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
  const muted = useMuted();
  const [paperOpen, setPaperOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const closePaper = () => {
    setPaperOpen(false);
    h.clearPaper();
  };
  const nameOf = (id: string) => {
    const c = getCard(id);
    return c ? (cardName(c, 'es')?.text ?? c.id) : id;
  };
  const who = (seat: string) => {
    if (seat.startsWith('paper:')) return t('host.game.paperName', { n: seat.slice(6) });
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
      if (el?.closest?.('[role="dialog"],[role="alertdialog"]')) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'l') {
        if (live || ended) {
          e.preventDefault();
          setPaperOpen(true);
        }
        return;
      }
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
  // Word cards: one per language in the room, plus the language being spoken.
  const wordLangs: Lang[] = [];
  for (const l of [...(room.langs ?? []), ...(h.currentLang ? [h.currentLang] : [])]) {
    if (!wordLangs.includes(l)) wordLangs.push(l);
  }
  const revealed = ended ? h.called : h.called.slice(0, -1);
  const history = [...revealed].reverse().flatMap((id) => {
    const c = getCard(id);
    return c ? [{ id, emoji: c.art, label: nameOf(id) }] : [];
  });
  const top = Object.entries(h.points)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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

      <div inert={paperOpen || undefined} className={styles.layout}>
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
                  <p>{t(`patternComplete.${state.settings.pattern}`)}</p>
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
              <Button variant="primary" onClick={h.newRound}>
                {t('host.newRound')}
              </Button>
            </PaperCard>
          ) : card ? (
            <>
              <ul className={styles.words} aria-label={t('host.game.wordsLabel')}>
                {wordLangs.map((l) => {
                  const n = cardName(card, l);
                  if (!n) return null;
                  return (
                    <li key={l} className={styles.wordItem}>
                      <WordCard
                        word={n.text}
                        langName={t(`lang.${l}`)}
                        tone={l}
                        review={n.status !== 'approved' ? 'word' : undefined}
                        verse={n.status === 'approved' ? t('host.game.pictureLater') : undefined}
                      />
                    </li>
                  );
                })}
              </ul>
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
              <Button variant="secondary" fit onClick={() => setPaperOpen(true)}>
                {t('host.checkPaper')}
              </Button>
              <Button variant="secondary" fit onClick={h.endRound}>
                {t('host.endRound')}
              </Button>
              <Button
                variant="secondary"
                fit
                aria-pressed={muted}
                onClick={() => setMuted(!muted)}
              >
                {muted ? t('host.unmute') : t('host.mute')}
              </Button>
            </div>
          ) : null}
          <p className={`${styles.sub} ${styles.hint}`}>{t('host.game.shortcuts')}</p>

          {h.claimNote ? (
            <p role="status" className={styles.notice}>
              {h.claimNote.valid
                ? t('host.claimNoteValid', { name: who(h.claimNote.seat) })
                : t('host.claimNoteInvalid', { name: who(h.claimNote.seat) })}
            </p>
          ) : null}
          {h.paper && !paperOpen ? <PaperResult h={h} nameOf={nameOf} /> : null}
        </section>

        <aside className={styles.side}>
          <QrCard url={room.joinUrl ?? ''} code={room.code} />
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
          <Panel as="section" aria-labelledby="pts">
            <div className={styles.panelHead}>
              <h2 id="pts" className={styles.panelH}>
                {t('host.game.points')}
              </h2>
              <span className={styles.sub}>{t('host.game.tiebreak')}</span>
            </div>
            {top.length ? (
              <ol className={styles.points}>
                {top.map(([seat, v]) => (
                  <li key={seat}>
                    <span>{who(seat)}</span>
                    <strong>{v}</strong>
                  </li>
                ))}
              </ol>
            ) : null}
            <span className={styles.sub}>{t('host.game.firstPlus', { n: 2 })}</span>
          </Panel>
        </aside>

        <footer className={styles.history}>
          <HistoryStrip items={history} title={t('host.game.history')} />
        </footer>
      </div>

      {paperOpen ? (
        <PaperDialog
          onClose={closePaper}
          onCheck={(code) => h.checkPaper(code)}
          h={h}
          nameOf={nameOf}
        />
      ) : null}
    </main>
  );
}

function PaperResult({ h, nameOf }: { h: Game; nameOf: (id: string) => string }) {
  const { t } = useTranslation();
  const p = h.paper;
  if (!p) return null;
  return (
    <div role="status" className={styles.notice}>
      {p.kind === 'invalid' ? <p>{t('host.paperCodeInvalid')}</p> : null}
      {p.kind === 'otherGame' ? <p>{t('host.otherGame')}</p> : null}
      {p.kind === 'valid' ? <p>{t('host.paperValid', { index: p.index + 1 })}</p> : null}
      {p.kind === 'almost' ? (
        <>
          <p>
            {t('host.almost')} {t('host.paperAlmost', { index: p.index + 1 })}{' '}
            {t('host.paperCodeMissing', { count: p.missing.length })}
          </p>
          <ul aria-label={t('host.paperMissingList')}>
            {p.missing.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function PaperDialog(props: {
  onClose: () => void;
  onCheck: (code: string) => void;
  h: Game;
  nameOf: (id: string) => string;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const box = useModal(props.onClose);
  useEffect(() => input.current?.focus(), []);
  return (
    <div className={styles.overlay}>
      <div
        ref={box}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-h"
      >
        <h2 id="paper-h">{t('host.checkPaper')}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            props.onCheck(code);
          }}
        >
          <label className={styles.field}>
            {t('host.paperCodePrompt')}
            <input
              ref={input}
              className={styles.input}
              value={code}
              maxLength={10}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className={styles.row}>
            <Button type="submit" variant="primary" fit>
              {t('host.check')}
            </Button>
            <Button variant="secondary" fit onClick={props.onClose}>
              {t('host.close')}
            </Button>
          </div>
        </form>
        <PaperResult h={props.h} nameOf={props.nameOf} />
      </div>
    </div>
  );
}
