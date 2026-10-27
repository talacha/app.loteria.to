import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cardName, getCard } from '@content';
import type { Lang } from '@engine';
import { isMuted, onMutedChange, setMuted } from '../audio';
import styles from '../host/HostPage.module.css';
import { useGame } from '../host/useGame';
import type { Game, GameProps } from '../host/useGame';
import { useModal } from '../host/useModal';

function useMuted(): boolean {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMutedChange(setM), []);
  return m;
}

/**
 * Game boundary (docs/rules.md will replace this): the cantor's round screen.
 * Props: { transport, room, roster } plus an optional onNewRound callback.
 */
export default function HostGame(props: GameProps) {
  const { t, i18n } = useTranslation();
  const h = useGame(props);
  const { state } = h;
  const { room, roster } = props;
  const muted = useMuted();
  const [paperOpen, setPaperOpen] = useState(false);
  const closePaper = () => {
    setPaperOpen(false);
    h.clearPaper();
  };
  const uiLang = i18n.language === 'en' ? 'en' : 'es';
  const lc = (l: string) => t(`lang.${l}`);
  const nameOf = (id: string) => {
    const c = getCard(id);
    return c ? (cardName(c, 'es')?.text ?? c.id) : id;
  };
  const who = (seat: string) =>
    h.names[seat] ??
    (() => {
      const p = roster.find((r) => r.seat === seat);
      return p ? `${p.glyph} ${p.name}` : t('host.unknownPlayer');
    })();

  const live = state.phase === 'running' || state.phase === 'paused';
  const ended = state.phase === 'ended';
  const justWon = state.phase === 'paused' && state.winners.length > 0 && h.celebrating;
  const modalOpen = justWon || paperOpen;
  const connection = room.connection ?? 'online';

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
      else if (k === 'n') h.next();
      else if (k === 'r') h.repeat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const card = h.current;
  const lang: Lang | undefined = h.currentLang;
  const callName = card && lang ? cardName(card, lang) : null;

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1>{t('host.title')}</h1>
        <p className={styles.status}>
          <span className={styles.roundNo}>{t('host.round', { n: state.roundNo })}</span>
          <span className={styles.roundNo}>{room.code}</span>
          <span className={`${styles.dot} ${styles[connection]}`} aria-hidden="true" />
          <span>{t(`host.connection.${connection}`)}</span>
          <span>{t('host.players', { count: roster.length })}</span>
        </p>
      </header>

      {connection === 'unverified' || connection === 'offline' ? (
        <p className={styles.notice} role="status">
          {connection === 'offline' ? t('host.offlineOk') : t('host.unverifiedRoom')}{' '}
          <Link className={styles.printLink} to={`/print?seed=${state.roomSeed}`}>
            {t('host.printLink')}
          </Link>
        </p>
      ) : null}

      {/* a11y: announces each called card (and repeats; keyed by call sequence) */}
      <div key={h.announcement.seq} aria-live="polite" className={styles.srOnly}>
        {h.announcement.text ? t('a11y.called', { card: h.announcement.text }) : ''}
      </div>

      <div inert={modalOpen || undefined} className={styles.content}>
        <section className={styles.stage} aria-labelledby="cur-h">
          <h2 id="cur-h" className={styles.srOnly}>
            {t('host.currentCard')}
          </h2>
          {card ? (
            <div className={styles.card}>
              <div className={styles.art} aria-hidden="true">
                {card.art}
              </div>
              {state.settings.captions || h.noAudio ? (
                <p className={styles.name}>
                  {callName?.text ?? nameOf(card.id)}
                  {lang ? <span className={styles.langTag}> ({lc(lang)})</span> : null}
                </p>
              ) : null}
              {h.noAudio ? <p className={styles.notice}>{t('host.noRecordingYet')}</p> : null}
              <p className={styles.verso}>{card.verso[uiLang]}</p>
            </div>
          ) : null}
          <p className={styles.muted}>{t('host.called', { count: h.called.length })}</p>
          {state.phase === 'paused' && !justWon ? <p role="status">{t('host.paused')}</p> : null}

          {ended ? (
            <div className={styles.panel}>
              <p>{t('host.ended')}</p>
              <h3>{t('host.winners')}</h3>
              {state.winners.length ? (
                <ul>
                  {state.winners.map((s) => (
                    <li key={s}>{who(s)}</li>
                  ))}
                </ul>
              ) : (
                <p>{t('host.noWinners')}</p>
              )}
              <button type="button" className={styles.primary} onClick={h.newRound}>
                {t('host.newRound')}
              </button>
            </div>
          ) : (
            <div className={styles.row}>
              <button type="button" className={styles.primary} onClick={h.togglePause}>
                {state.phase === 'running' ? t('host.pause') : t('host.resume')}
              </button>
              <button type="button" className={styles.btn} onClick={h.next}>
                {t('host.nextCard')}
              </button>
              <button type="button" className={styles.btn} onClick={h.repeat}>
                {t('host.repeat')}
              </button>
              <button type="button" className={styles.btn} onClick={() => setPaperOpen(true)}>
                {t('host.checkPaper')}
              </button>
              <button type="button" className={styles.btn} onClick={h.endRound}>
                {t('host.endRound')}
              </button>
            </div>
          )}
          <p className={`${styles.muted} ${styles.hint}`}>{t('host.shortcuts')}</p>

          {h.claimNote && !justWon ? (
            <p role="status" className={styles.notice}>
              {h.claimNote.valid
                ? t('host.claimNoteValid', { name: who(h.claimNote.seat) })
                : t('host.claimNoteInvalid', { name: who(h.claimNote.seat) })}
            </p>
          ) : null}

          {h.paper && !paperOpen ? <PaperResult h={h} nameOf={nameOf} /> : null}

          <h3>{t('host.history')}</h3>
          <ol className={styles.history} aria-label={t('host.history')} reversed>
            {[...h.called].reverse().map((id) => {
              const c = getCard(id);
              return (
                <li key={id} className={styles.chip} title={nameOf(id)}>
                  <span aria-hidden="true">{c?.art}</span>
                  <span className={styles.chipName}>{nameOf(id)}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className={styles.row}>
          <button
            type="button"
            className={styles.btn}
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
          >
            {muted ? t('host.unmute') : t('host.mute')}
            <span className={styles.srOnly}>{muted ? ` (${t('a11y.muted')})` : ''}</span>
          </button>
          <Link className={styles.btn} to={`/print?seed=${state.roomSeed}`}>
            {t('host.printLink')}
          </Link>
        </div>
      </div>

      {justWon ? (
        <Celebration
          title={t('host.celebrate')}
          body={t('host.celebrateBody', {
            name: who(state.winners[state.winners.length - 1] ?? ''),
          })}
          pattern={t(`patternComplete.${state.settings.pattern}`)}
          onContinue={h.resumeCalling}
          onEnd={h.endRound}
          continueLabel={t('host.continue')}
          endLabel={t('host.endRound')}
        />
      ) : null}

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

function Celebration(props: {
  title: string;
  body: string;
  pattern: string;
  continueLabel: string;
  endLabel: string;
  onContinue: () => void;
  onEnd: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const box = useModal(props.onContinue);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className={styles.overlay}>
      <div
        ref={box}
        className={styles.celebrate}
        role="alertdialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <p className={styles.burst} aria-hidden="true">
          🎉
        </p>
        <h2>{props.title}</h2>
        <p>{props.body}</p>
        <p>{props.pattern}</p>
        <div className={styles.row}>
          <button ref={ref} type="button" className={styles.primary} onClick={props.onContinue}>
            {props.continueLabel}
          </button>
          <button type="button" className={styles.btn} onClick={props.onEnd}>
            {props.endLabel}
          </button>
        </div>
      </div>
    </div>
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
              <li key={id}>
                {getCard(id)?.art} {nameOf(id)}
              </li>
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
            <button type="submit" className={styles.primary}>
              {t('host.check')}
            </button>
            <button type="button" className={styles.btn} onClick={props.onClose}>
              {t('host.close')}
            </button>
          </div>
        </form>
        <PaperResult h={props.h} nameOf={props.nameOf} />
      </div>
    </div>
  );
}
