import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './RoomCode.module.css';

export interface RoomCodeProps {
  code: string;
}

/** Group as 3 + 2 so it is easy to read aloud. */
const groupCode = (code: string) =>
  code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

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
      <p className={styles.label}>{t('lobby.roomCode')}</p>
      <p className={styles.code}>
        <span className={styles.sr}>
          {t('lobby.roomCodeSpoken', { letters: code.split('').join(', ') })}
        </span>
        <span aria-hidden="true">{groupCode(code)}</span>
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
