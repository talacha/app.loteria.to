import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@engine';
import { createTransport, getSeat, type Transport } from '@net';
import { setUiLang } from '../theme/prefs';
import { mergeProfile } from '../ui/profile';
import PlayerGame from '../game/PlayerGame';
import type { PlayerProfile } from '../player/PlayerBoard';
import Roster, { type RosterPlayer } from './Roster';
import UiLangSwitch from '../player/UiLangSwitch';
import { Button, Panel, PaperCard, Pill, RoomCodeTiles } from '../ui';
import { MessageLog } from './messageLog';
import ConnectionRecovery from './ConnectionRecovery';
import { connectionRecoveryKey, type ConnectionRecoveryKey } from './recoveryReason';
import styles from './LobbyWaiting.module.css';

export interface LobbyWaitingProps {
  code: string;
  profile: PlayerProfile;
  hostKey?: string;
  /** True only when the host key came from the QR/link fragment (#k=). */
  hostKeyFromQr?: boolean;
  onLeave: () => void;
  /** "Crear una sala nueva" when the room is full; defaults to going to /host. */
  onCreateRoom?: () => void;
  /** Test seam: receives the seat to pin. */
  transportFactory?: (seat: string) => Transport;
}

const HELLO_RETRY_MS = 3000;
const HELLO_MAX_RETRIES = 3;
const NO_HOST_MS = 12000;

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
  onCreateRoom,
  transportFactory,
}: LobbyWaitingProps) {
  const { t } = useTranslation();
  const [log] = useState(() => new MessageLog());
  const [live, setLive] = useState<Live | null>(null);
  const [lost, setLost] = useState(false);
  const [recovery, setRecovery] = useState<ConnectionRecoveryKey | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [noHost, setNoHost] = useState(false);
  const [full, setFull] = useState(false);
  /** Spoken language taken from the room's defaults on arrival (the player can change it). */
  const [roomSpoken, setRoomSpoken] = useState<Lang | null>(null);
  const { name, glyph, pronouns, spokenLang } = profile;

  useEffect(() => {
    let alive = true;
    let tr: Transport | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let noHostTimer: ReturnType<typeof setTimeout> | undefined;
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
      let activeSpokenLang = spokenLang;
      const hello = () => {
        lastHello = Date.now();
        mine.send({
          t: 'hello',
          seat: mine.seat,
          name,
          glyph,
          pronouns: pronouns || undefined,
          labelLang: activeSpokenLang,
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
            if (m.defaults) {
              // What joiners start with: applied once per room and tab, never again.
              const key = `loteria:defaults:${code}`;
              let done = false;
              try {
                done = sessionStorage.getItem(key) === '1';
                if (!done) sessionStorage.setItem(key, '1');
              } catch {
                /* storage unavailable: apply once per mount below */
              }
              if (!done) {
                setUiLang(m.defaults.uiLang);
                mergeProfile({ spokenLang: m.defaults.spokenLang });
                setRoomSpoken(m.defaults.spokenLang);
                if (activeSpokenLang !== m.defaults.spokenLang) {
                  activeSpokenLang = m.defaults.spokenLang;
                  hello();
                }
              }
            }
            const inRoom = m.players.some((p) => p.seat === mine.seat);
            hostKnowsMe = inRoom;
            if (inRoom) {
              setFull(false);
            } else if (m.status === 'full') {
              // The host rejected my hello: 20 players are already in.
              setFull(true);
            } else {
              // e.g. the host reloaded and lost its roster.
              rehello();
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
          case 'callClosed':
          case 'pickResult':
          case 'scores':
          case 'end':
            log.push(m);
            break;
          default:
            break;
        }
      });
      const handleError = (error: unknown) => {
        if (!alive) return;
        setLost(true);
        const key = connectionRecoveryKey(error);
        if (key) {
          setRecovery(key);
          clearTimeout(noHostTimer);
          setNoHost(false);
        }
      };
      mine.onError?.(handleError);
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
        .catch(handleError);
    }, 0);
    return () => {
      alive = false;
      clearTimeout(start);
      clearTimeout(retry);
      clearTimeout(noHostTimer);
      clearInterval(assignWatch);
      if (tr) void tr.leave();
    };
  }, [code, hostKey, hostKeyFromQr, transportFactory, name, glyph, pronouns, spokenLang, log]);

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
          profile={roomSpoken ? { ...profile, spokenLang: roomSpoken } : profile}
          log={log}
          recovery={recovery}
          onLeave={leave}
          onBackToLobby={() => setPlaying(false)}
        />
      </>
    );
  }

  const langName = t(`lobby.langs.${spokenLang}.name`);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Button variant="link" icon={<Chevron />} onClick={leave}>
            {t('lobby.leave')}
          </Button>
          <span className={styles.topEnd}>
            <UiLangSwitch />
            <span role="status">
              <Pill tone={lost ? 'paper' : 'jade'} dot={!!live && !lost}>
                {lost
                  ? t('player.connectionLost')
                  : live
                    ? t('player.connected')
                    : t('player.connecting')}
                {live && !lost ? (
                  <>
                    {' · '}
                    {live.verified ? t('lobby.verified') : t('lobby.unverified')}
                  </>
                ) : null}
              </Pill>
            </span>
          </span>
        </div>

        {recovery ? <ConnectionRecovery recovery={recovery} /> : null}

        <div className={styles.cols}>
          <div className={styles.col}>
            <PaperCard size="lg" className={styles.codeCard}>
              <RoomCodeTiles code={code} label={t('lobby.room')} />
              <div className={styles.youPlay}>
                <span>{t('lobby.youPlay', { lang: langName })}</span>
              </div>
            </PaperCard>

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
              <div className={styles.notice} role="alert">
                <strong>{t('lobby.fullTitle')}</strong>
                <p>{t('lobby.fullLead')}</p>
                <Button onClick={onCreateRoom ?? (() => window.location.assign('/host'))}>
                  {t('lobby.createRoom')}
                </Button>
              </div>
            )}

            <div className={styles.head}>
              <h1 className={styles.title}>{t('lobby.waitingTitle')}</h1>
              <p className={styles.lead}>{t('lobby.waitingLead')}</p>
            </div>
          </div>

          <div className={styles.col}>
            <Roster players={roster} selfSeat={live?.seat} />
            <Panel variant="dashed" className={styles.invite}>
              <svg
                aria-hidden="true"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-maiz)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 20h3v1" />
              </svg>
              <p>{t('lobby.invite', { code })}</p>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

function Chevron() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
