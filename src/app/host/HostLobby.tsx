import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import QRCode from 'qrcode';
import type { PatternId } from '@engine';
import Roster from '../lobby/Roster';
import RoomCode from '../lobby/RoomCode';
import styles from './HostLobby.module.css';
import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS } from './roundMachine';
import type { CallLang } from './roundMachine';
import { MAX_PLAYERS } from './useHostRoom';
import type { HostRoom } from './useHostRoom';
import { callableLangs } from '@content';

const PATTERNS: PatternId[] = ['line', 'corners', 'center', 'full'];

function useQr(text: string): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, {
      margin: 4,
      width: 640,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''));
    return () => {
      alive = false;
    };
  }, [text]);
  return url;
}

export default function HostLobby({ room }: { room: HostRoom }) {
  const { t } = useTranslation();
  const qr = useQr(room.joinUrl);
  const [copied, setCopied] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [seedError, setSeedError] = useState(false);
  const { settings } = room;
  const callable = callableLangs();
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
          <span className={`${styles.dot} ${styles[room.connection]}`} aria-hidden="true" />
          <span>{t(`host.connection.${room.connection}`)}</span>
        </p>
      </header>

      {room.connection === 'unverified' || room.connection === 'offline' ? (
        <p className={styles.notice} role="status">
          {room.connection === 'offline' ? t('host.offlineOk') : t('host.unverifiedRoom')}{' '}
          <Link className={styles.printLink} to={`/print?seed=${room.seed}`}>
            {t('host.printLink')}
          </Link>
        </p>
      ) : null}

      <div className={styles.columns}>
        <section className={styles.share} aria-labelledby="share-h">
          <h2 id="share-h" className={styles.srOnly}>
            {t('host.scanQr')}
          </h2>
          {qr ? (
            <img className={styles.qr} src={qr} alt={t('host.scanQr')} width={640} height={640} />
          ) : (
            <div className={styles.qr} aria-hidden="true" />
          )}
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={() => void copy()}>
              {copied ? t('host.lobby.linkCopied') : t('host.lobby.copyLink')}
            </button>
            {canShare ? (
              <button type="button" className={styles.btn} onClick={share}>
                {t('host.lobby.share')}
              </button>
            ) : null}
          </div>
          <RoomCode code={room.code} />
          <p className={styles.srOnly} role="status">
            {copied ? t('host.lobby.linkCopied') : ''}
          </p>
          <p className={styles.url}>{room.joinUrl}</p>
        </section>

        <div className={styles.side}>
          <Roster players={room.roster} max={MAX_PLAYERS} />
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
              <label className={styles.field}>
                {t('host.callLang')}
                <select
                  className={styles.input}
                  value={settings.callLang}
                  onChange={(e) => room.configure({ callLang: e.target.value as CallLang })}
                >
                  {callable.map((l) => (
                    <option key={l} value={l}>
                      {t(`lang.${l}`)}
                    </option>
                  ))}
                  {callable.length > 1 ? (
                    <option value="rotating">{t('host.rotating')}</option>
                  ) : null}
                </select>
              </label>

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

              <label className={styles.field}>
                {t('host.pattern')}
                <select
                  className={styles.input}
                  value={settings.pattern}
                  onChange={(e) => room.configure({ pattern: e.target.value as PatternId })}
                >
                  {PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {t(`host.patterns.${p}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={settings.mode === 'escucha'}
                  onChange={(e) =>
                    room.configure({ mode: e.target.checked ? 'escucha' : 'normal' })
                  }
                />
                <span>
                  {t('host.listenMode')}
                  <small className={styles.muted}> {t('host.listenModeHint')}</small>
                </span>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={settings.captions}
                  onChange={(e) => room.configure({ captions: e.target.checked })}
                />
                <span>{t('host.captions')}</span>
              </label>

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
        {room.roster.length === 0 ? (
          <p className={styles.hint}>{t('host.lobby.zeroHint')}</p>
        ) : null}
        <button type="button" className={styles.start} onClick={room.startGame}>
          {t('host.start')}
        </button>
      </div>
    </main>
  );
}
