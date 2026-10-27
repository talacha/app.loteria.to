import { useTranslation } from 'react-i18next';
import HostGame from '../game/HostGame';
import styles from './HostPage.module.css';
import HostLobby from './HostLobby';
import { useHostRoom } from './useHostRoom';

export default function HostPage() {
  const { t } = useTranslation();
  const room = useHostRoom();

  if (room.phase === 'boot') {
    return (
      <main id="main" className={styles.page}>
        <h1>{t('host.title')}</h1>
      </main>
    );
  }

  if (room.phase === 'prompt' && room.saved) {
    return (
      <main id="main" className={styles.page}>
        <h1>{t('host.title')}</h1>
        <section className={styles.panel} aria-labelledby="resume-h">
          <h2 id="resume-h">{t('host.resumeTitle')}</h2>
          <p>
            {room.saved.phase === 'setup'
              ? t('host.resumeLobbyBody', { code: room.saved.code })
              : t('host.resumeBody', { code: room.saved.code, count: room.saved.calledCount })}
          </p>
          <div className={styles.row}>
            <button type="button" className={styles.primary} onClick={room.resume}>
              {t('host.resumeYes')}
            </button>
            <button type="button" className={styles.btn} onClick={room.discard}>
              {t('host.resumeNo')}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (room.phase === 'game') {
    return (
      <HostGame
        transport={room.transport}
        room={{
          code: room.code,
          seed: room.seed,
          hostKey: room.hostKey,
          roundNo: room.roundNo,
          settings: room.settings,
          saved: room.gameSaved,
          connection: room.connection,
          joinUrl: room.joinUrl,
          langs: room.langs,
          local: room.local,
          isMember: room.isMember,
          getRoster: room.getRoster,
        }}
        roster={room.roster}
        onNewRound={room.backToLobby}
      />
    );
  }

  return <HostLobby room={room} />;
}
