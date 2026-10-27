import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@engine';
import { Button } from '../ui';
import { buildPlayerBoardPdf } from './printBoard';
import styles from './PlayerBoard.module.css';

export interface PrintBoardButtonProps {
  seed: string;
  tablaIndex: number;
  name: string;
  code: string;
  spokenLang: Lang;
}

/** "Imprimir mi cartón": one-page PDF of my own tabla; words are an opt-in toggle. */
export default function PrintBoardButton(p: PrintBoardButtonProps) {
  const { t } = useTranslation();
  const [words, setWords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function print() {
    setBusy(true);
    setError(false);
    try {
      const bytes = await buildPlayerBoardPdf({ ...p, showWords: words });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `loteria-${p.code}-carton.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.group}>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={words} onChange={(e) => setWords(e.target.checked)} />
        {t('player.printWords')}
      </label>
      <Button variant="secondary" loading={busy} onClick={() => void print()}>
        {t('player.printBoard')}
      </Button>
      {error ? (
        <p role="alert" className={styles.muted}>
          {t('player.printError')}
        </p>
      ) : null}
    </div>
  );
}
