import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ui.module.css';

export type PillTone = 'paper' | 'night' | 'jade' | 'nah' | 'yua' | 'quz' | 'es' | 'en';

/** Small status/language label. Colour is never the only signal: always pass text. */
export function Pill({
  tone = 'paper',
  dot,
  children,
}: {
  tone?: PillTone;
  /** Leading status dot (e.g. "Conectado"). */
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export type ReviewVariant = 'word' | 'words' | 'ai';

/** The honesty tag for unreviewed words and AI voices. Never hide it. */
export function ReviewTag({ variant = 'word' }: { variant?: ReviewVariant }) {
  const { t } = useTranslation();
  return <span className={styles.review}>{t(`theme.kit.review.${variant}`)}</span>;
}
