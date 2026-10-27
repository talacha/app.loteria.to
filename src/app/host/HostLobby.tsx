import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, Panel, Pill, QrCard, RoomCodeTiles, RosterTile } from '../ui';
import styles from './HostLobby.module.css';
import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS } from './roundMachine';
import { MAX_PLAYERS } from './useHostRoom';
import type { HostRoom } from './useHostRoom';

/** Polite announcement when someone joins or leaves (the first roster is the baseline). */
function useRosterNote(players: { seat: string; name: string }[]): string {
  const { t } = useTranslation();
  const [prev, setPrev] = useState(players);
  const [note, setNote] = useState('');
  if (prev !== players) {
    const before = new Set(prev.map((p) => p.seat));
    const after = new Set(players.map((p) => p.seat));
    const msgs = [
      ...players.filter((p) => !before.has(p.seat)).map((p) => t('lobby.joined', { name: p.name })),
      ...prev.filter((p) => !after.has(p.seat)).map((p) => t('lobby.left', { name: p.name })),
    ];
    setPrev(players);
    if (msgs.length) setNote(msgs.join('. '));
  }
  return note;
}

export default function HostLobby({ room }: { room: HostRoom }) {
  const { t } = useTranslation();
  const rosterNote = useRosterNote(room.roster);
  const [copied, setCopied] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [seedError, setSeedError] = useState(false);
  const { settings } = room;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  const share = () => {
    void navigator
      .share({
        title: t('host.lobby.shareTitle'),
        text: t('host.lobby.shareText', { code: room.code }),
        url: room.joinUrl,
      })
      .catch(() => undefined);
  };
  const onSeed = (e: FormEvent) => {
    e.preventDefault();
    setSeedError(!room.setPrintSeed(seedInput));
  };

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1>{t('host.title')}</h1>
        <p className={styles.status}>
          <span className={styles.roundNo}>{t('host.round', { n: room.roundNo })}</span>
          <Pill tone={room.connection === 'online' ? 'jade' : 'paper'}>
            {t(`host.connection.${room.connection}`)}
          </Pill>
        </p>
      </header>
      <p className={styles.lead}>{t('host.lobby.lead')}</p>

      {room.connection === 'unverified' || room.connection === 'offline' ? (
        <p className={styles.notice} role="status">
          {room.connection === 'offline' ? t('host.offlineOk') : t('host.unverifiedRoom')}
        </p>
      ) : null}

      <div className={styles.columns}>
        <section className={styles.share} aria-labelledby="share-h">
          <h2 id="share-h" className={styles.srOnly}>
            {t('host.scanQr')}
          </h2>
          <QrCard url={room.joinUrl} code={room.code} />
          <RoomCodeTiles code={room.code} label={t('host.lobby.roomLabel')} />
          <div className={styles.row}>
            <Button variant="secondary" fit onClick={() => void copy()}>
              {copied ? t('host.lobby.linkCopied') : t('host.lobby.copyLink')}
            </Button>
            {canShare ? (
              <Button variant="secondary" fit onClick={share}>
                {t('host.lobby.share')}
              </Button>
            ) : null}
          </div>
          <p className={styles.srOnly} role="status">
            {copied ? t('host.lobby.linkCopied') : ''}
          </p>
          <Button variant="link" to={`/print?seed=${room.seed}`} icon={<PrinterIcon />}>
            {t('host.lobby.noPhone')}
          </Button>
        </section>

        <div className={styles.side}>
          <section aria-labelledby="roster-h" className={styles.rosterBox}>
            <h2 id="roster-h" className={styles.rosterH}>
              {t('host.lobby.count', { count: room.roster.length })}
              <span className={styles.muted}>
                {' '}
                · {room.roster.length}/{MAX_PLAYERS}
              </span>
            </h2>
            <p className={styles.srOnly} role="status">
              {rosterNote}
            </p>
            {room.roster.length === 0 ? (
              <Panel variant="dashed">
                <p className={styles.hint}>{t('host.lobby.zeroHint')}</p>
              </Panel>
            ) : (
              <ul className={styles.roster} aria-label={t('lobby.roster')}>
                {room.roster.map((p) => (
                  <li key={p.seat}>
                    <RosterTile name={p.name} glyph={p.glyph} detail={p.pronouns} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {room.roster.length > 0 ? (
            <details className={styles.settings}>
              <summary>{t('host.lobby.manage')}</summary>
              <ul className={styles.manage}>
                {room.roster.map((p) => (
                  <li key={p.seat}>
                    <span>
                      {p.glyph} {p.name}
                    </span>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => room.removePlayer(p.seat)}
                      aria-label={t('host.lobby.removeNamed', { name: p.name })}
                    >
                      {t('host.lobby.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <details className={styles.settings}>
            <summary>{t('host.lobby.settings')}</summary>
            <div className={styles.settingsBody}>
              <fieldset className={styles.field}>
                <legend>{t('host.speed')}</legend>
                <div className={styles.row}>
                  {(['calm', 'normal', 'fast'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={
                        settings.speedSec === SPEED_PRESETS[k] ? styles.primary : styles.btn
                      }
                      aria-pressed={settings.speedSec === SPEED_PRESETS[k]}
                      onClick={() => room.configure({ speedSec: SPEED_PRESETS[k] })}
                    >
                      {t(`host.speeds.${k}`)}
                    </button>
                  ))}
                </div>
                <label>
                  <span className={styles.srOnly}>{t('host.speedSlider')}</span>
                  <input
                    type="range"
                    className={styles.range}
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    value={settings.speedSec}
                    aria-valuetext={t('host.speedSeconds', { seconds: settings.speedSec })}
                    onChange={(e) => room.configure({ speedSec: Number(e.target.value) })}
                  />
                </label>
                <span>{t('host.speedSeconds', { seconds: settings.speedSec })}</span>
              </fieldset>

              <h3>{t('host.printSeed')}</h3>
              <form onSubmit={onSeed}>
                <label className={styles.field}>
                  {t('host.printSeedHelp')}
                  <input
                    className={styles.input}
                    value={seedInput}
                    maxLength={12}
                    autoCapitalize="characters"
                    autoComplete="off"
                    aria-invalid={seedError}
                    onChange={(e) => setSeedInput(e.target.value)}
                  />
                </label>
                {seedError ? <p role="alert">{t('host.printSeedInvalid')}</p> : null}
                <div className={styles.row}>
                  <button type="submit" className={styles.btn}>
                    {t('host.printSeedApply')}
                  </button>
                  <button type="button" className={styles.btn} onClick={room.randomSeed}>
                    {t('host.seedNew')}
                  </button>
                </div>
              </form>
              <p className={styles.muted}>{t('host.seedCurrent', { seed: room.seed })}</p>
              <p>
                <Link className={styles.printLink} to={`/print?seed=${room.seed}`}>
                  {t('host.printLink')}
                </Link>
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className={styles.startBar}>
        <Button variant="primary" disabled={!room.canStart} onClick={room.startGame}>
          {t('host.start')}
        </Button>
        {!room.canStart ? (
          <p className={styles.hint} role="status">
            {t('host.lobby.missing', { count: room.missing })}
          </p>
        ) : null}
        {room.full ? (
          <p className={styles.hint} role="status">
            {t('host.lobby.full', { count: MAX_PLAYERS, max: MAX_PLAYERS })}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function PrinterIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
    </svg>
  );
}
