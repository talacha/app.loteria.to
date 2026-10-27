import { useTranslation } from 'react-i18next';
import { Button, Panel } from '../ui';
import type { ConnectionRecoveryKey } from './recoveryReason';

export default function ConnectionRecovery({ recovery }: { recovery: ConnectionRecoveryKey }) {
  const { t } = useTranslation();
  return (
    <div role="alert">
      <Panel>
        <p>{t(recovery)}</p>
        <Button onClick={() => window.location.reload()}>{t('player.refreshScreen')}</Button>
      </Panel>
    </div>
  );
}
