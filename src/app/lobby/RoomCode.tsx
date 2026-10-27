import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './RoomCode.module.css';

export interface RoomCodeProps {
  code: string;
}

export default function RoomCode({ code }: RoomCodeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>{t('lobby.room')}</p>
      <p className={styles.code}>
        <span className={styles.sr}>
          {t('lobby.roomCodeSpoken', { letters: code.split('').join(', ') })}
        </span>
        <span className={styles.tiles} aria-hidden="true">
          {code.split('').map((ch, i) => (
            <span key={i} className={styles.tile}>
              {ch}
            </span>
          ))}
        </span>
      </p>
      <button type="button" className={styles.copy} onClick={() => void copy()}>
        {copied ? t('lobby.copied') : t('lobby.copy')}
      </button>
      <span role="status" className={styles.sr}>
        {copied ? t('lobby.copied') : ''}
      </span>
    </div>
  );
}
