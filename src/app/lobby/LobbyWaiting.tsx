import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createTransport, getSeat, type Transport } from '@net';
import PlayerGame from '../game/PlayerGame';
import type { PlayerProfile } from '../player/PlayerBoard';
import Roster, { type RosterPlayer } from './Roster';
import RoomCode from './RoomCode';
import { MessageLog } from './messageLog';
import { langInReview } from './langInfo';
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
const NO_HOST_MS = 12000;
const FULL_MS = 6000;
const MAX_PLAYERS = 60;

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
  const [noHost, setNoHost] = useState(false);
  const [full, setFull] = useState(false);
  const { name, glyph, pronouns, labelLang } = profile;

  useEffect(() => {
    let alive = true;
    let tr: Transport | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let noHostTimer: ReturnType<typeof setTimeout> | undefined;
    let fullTimer: ReturnType<typeof setTimeout> | undefined;
    let assignWatch: ReturnType<typeof setInterval> | undefined;
    // Deferred so React StrictMode's mount/cleanup/mount pass joins only once.
    const start = setTimeout(() => {
      const seatId = getSeat(code, 'player');
      const mine = transportFactory ? transportFactory(seatId) : createTransport({ seat: seatId });
      tr = mine;
      let hostKnowsMe = false;
      let roundSeen = false;
      let lobbySeen = false;
      let lastHello = 0;
      let assignedRound = -1;
      let currentRound = -1;
      const hello = () => {
        lastHello = Date.now();
        mine.send({
          t: 'hello',
          seat: mine.seat,
          name,
          glyph,
          pronouns: pronouns || undefined,
          labelLang,
        });
      };
      /** Re-announce myself, at most once per HELLO_RETRY_MS. */
      const rehello = () => {
        if (Date.now() - lastHello >= HELLO_RETRY_MS) hello();
      };
      mine.onMessage((m) => {
        if (!alive) return;
        switch (m.t) {
          case 'lobby': {
            lobbySeen = true;
            clearTimeout(noHostTimer);
            setNoHost(false);
            setRoster(m.players);
            const inRoom = m.players.some((p) => p.seat === mine.seat);
            hostKnowsMe = inRoom;
            if (inRoom) {
              clearTimeout(fullTimer);
              fullTimer = undefined;
              setFull(false);
            } else {
              // e.g. the host reloaded and lost its roster.
              rehello();
              if (m.players.length >= MAX_PLAYERS && !fullTimer)
                fullTimer = setTimeout(() => {
                  if (alive && !hostKnowsMe) setFull(true);
                }, FULL_MS);
            }
            if (m.status === 'started') setPlaying(true);
            break;
          }
          case 'round':
            roundSeen = true;
            currentRound = m.roundNo;
            setPlaying(true);
            log.push(m);
            if (!assignWatch)
              assignWatch = setInterval(() => {
                if (assignedRound !== currentRound) rehello();
              }, HELLO_RETRY_MS);
            break;
          case 'assign':
            if (m.seat === mine.seat) assignedRound = m.roundNo;
            log.push(m);
            break;
          case 'call':
          case 'pickResult':
          case 'scores':
          case 'claimResult':
          case 'end':
            log.push(m);
            break;
          default:
            break;
        }
      });
      mine.onError?.(() => alive && setLost(true));
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
          noHostTimer = setTimeout(() => {
            if (alive && !lobbySeen) setNoHost(true);
          }, NO_HOST_MS);
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
      clearTimeout(noHostTimer);
      clearTimeout(fullTimer);
      clearInterval(assignWatch);
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
          onLeave={leave}
        />
      </>
    );
  }

  const langName = t(`lobby.langs.${labelLang}.name`);
  const review = langInReview(labelLang);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <button type="button" className={styles.back} onClick={leave}>
            <span aria-hidden="true">‹</span> {t('lobby.leave')}
          </button>
          <span
            className={styles.pill}
            role="status"
            data-state={lost ? 'lost' : live ? 'ok' : 'wait'}
          >
            <span aria-hidden="true">{lost ? '▲' : live ? '●' : '○'}</span>{' '}
            {lost
              ? t('player.connectionLost')
              : live
                ? t('player.connected')
                : t('player.connecting')}
            {live && (
              <>
                {' · '}
                {live.verified ? t('lobby.verified') : t('lobby.unverified')}
              </>
            )}
          </span>
        </div>

        <div className={styles.codeCard}>
          <RoomCode code={code} />
          <div className={styles.youPlay}>
            <span>{t('lobby.youPlay', { lang: langName })}</span>
            {review && <span className={styles.review}>{t('lobby.reviewShort')}</span>}
          </div>
        </div>

        {live && !live.verified && <p className={styles.notice}>{t('host.unverifiedRoom')}</p>}
        {noHost && (
          <p className={styles.notice} role="alert">
            {t('lobby.noHost')}{' '}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                leave();
              }}
            >
              {t('lobby.toHome')}
            </a>
          </p>
        )}
        {full && (
          <p className={styles.notice} role="alert">
            {t('lobby.full')}
          </p>
        )}

        <div className={styles.head}>
          <h1 className={styles.title}>{t('lobby.waitingTitle')}</h1>
          <p className={styles.lead}>{t('lobby.waitingLead')}</p>
        </div>

        <Roster players={roster} selfSeat={live?.seat} />

        <p className={styles.invite}>{t('lobby.invite', { code })}</p>
      </div>
    </main>
  );
}
