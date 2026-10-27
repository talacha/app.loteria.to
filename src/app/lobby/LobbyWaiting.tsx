import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createTransport, getSeat, type Transport } from '@net';
import PlayerGame from '../game/PlayerGame';
import type { PlayerProfile } from '../player/PlayerBoard';
import Roster, { type RosterPlayer } from './Roster';
import RoomCode from './RoomCode';
import { MessageLog } from './messageLog';
import styles from './LobbyWaiting.module.css';

export interface LobbyWaitingProps {
  code: string;
  profile: PlayerProfile;
  hostKey?: string;
  /** True only when the host key came from the QR/link fragment (#k=). */
  hostKeyFromQr?: boolean;
  onLeave: () => void;
  /** Test seam: receives the seat to pin. */
  transportFactory?: (seat: string) => Transport;
}

const HELLO_RETRY_MS = 3000;
const HELLO_MAX_RETRIES = 3;

interface Live {
  transport: Transport;
  seat: string;
  verified: boolean;
}

export default function LobbyWaiting({
  code,
  profile,
  hostKey,
  hostKeyFromQr = false,
  onLeave,
  transportFactory,
}: LobbyWaitingProps) {
  const { t } = useTranslation();
  const [log] = useState(() => new MessageLog());
  const [live, setLive] = useState<Live | null>(null);
  const [lost, setLost] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [playing, setPlaying] = useState(false);
  const { name, glyph, pronouns, labelLang } = profile;

  useEffect(() => {
    let alive = true;
    let tr: Transport | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Deferred so React StrictMode's mount/cleanup/mount pass joins only once.
    const start = setTimeout(() => {
      const seatId = getSeat(code, 'player');
      const mine = transportFactory ? transportFactory(seatId) : createTransport({ seat: seatId });
      tr = mine;
      let hostKnowsMe = false;
      let roundSeen = false;
      mine.onMessage((m) => {
        if (!alive) return;
        switch (m.t) {
          case 'lobby':
            setRoster(m.players);
            if (m.players.some((p) => p.seat === mine.seat)) hostKnowsMe = true;
            if (m.status === 'started') setPlaying(true);
            break;
          case 'round':
            roundSeen = true;
            setPlaying(true);
            log.push(m);
            break;
          case 'assign':
          case 'call':
          case 'claimResult':
          case 'end':
            log.push(m);
            break;
          default:
            break;
        }
      });
      mine.onError?.(() => alive && setLost(true));
      const hello = () =>
        mine.send({
          t: 'hello',
          seat: mine.seat,
          name,
          glyph,
          pronouns: pronouns || undefined,
          labelLang,
        });
      mine
        .join(code, 'player', hostKey ? { hostKey } : undefined)
        .then(() => {
          if (!alive) return;
          setLive({
            transport: mine,
            seat: mine.seat,
            verified: hostKeyFromQr && mine.isHostVerified(),
          });
          hello();
          let tries = 0;
          const again = () => {
            if (!alive || roundSeen || hostKnowsMe || tries >= HELLO_MAX_RETRIES) return;
            tries += 1;
            hello();
            retry = setTimeout(again, HELLO_RETRY_MS);
          };
          retry = setTimeout(again, HELLO_RETRY_MS);
        })
        .catch(() => alive && setLost(true));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(start);
      clearTimeout(retry);
      if (tr) void tr.leave();
    };
  }, [code, hostKey, hostKeyFromQr, transportFactory, name, glyph, pronouns, labelLang, log]);

  const leave = () => {
    if (live) void live.transport.leave();
    onLeave();
  };

  if (live && playing) {
    return (
      <>
        <PlayerGame
          transport={live.transport}
          room={{ code, seat: live.seat, hostVerified: live.verified }}
          roster={roster}
          profile={profile}
          log={log}
        />
        <div className={styles.leaveRow}>
          <button type="button" className={styles.leave} onClick={leave}>
            {t('player.leave')}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('lobby.title')}</h1>
      <RoomCode code={code} />
      <p
        className={styles.status}
        role="status"
        data-state={live ? (lost ? 'lost' : 'ok') : 'wait'}
      >
        <span aria-hidden="true">{lost ? '▲' : live ? '●' : '○'}</span>{' '}
        {lost ? t('player.connectionLost') : live ? t('player.connected') : t('player.connecting')}
        {live && (
          <>
            {' · '}
            {live.verified ? t('lobby.verified') : t('lobby.unverified')}
          </>
        )}
      </p>
      {live && !live.verified && <p className={styles.notice}>{t('host.unverifiedRoom')}</p>}
      <p className={styles.waiting}>{t('lobby.waiting')}</p>
      <Roster players={roster} selfSeat={live?.seat} />
      <button type="button" className={styles.leave} onClick={leave}>
        {t('player.leave')}
      </button>
    </div>
  );
}
