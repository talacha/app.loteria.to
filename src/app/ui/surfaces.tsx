import type { ElementType, ReactNode } from 'react';
import styles from './ui.module.css';

type Boxed = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
  'aria-labelledby'?: string;
};

export function Panel({
  variant = 'default',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: Boxed & { variant?: 'default' | 'dashed' }) {
  return (
    <Tag
      className={[styles.panel, className].filter(Boolean).join(' ')}
      data-variant={variant}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PaperCard({
  size = 'md',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: Boxed & { size?: 'md' | 'lg' }) {
  return (
    <Tag
      className={[styles.paperCard, className].filter(Boolean).join(' ')}
      data-size={size}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Time (maiz) or progress (jade) bar. */
export function ProgressBar({
  value,
  tone = 'maiz',
  label,
}: {
  /** 0..1 */
  value: number;
  tone?: 'maiz' | 'jade';
  label: string;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={styles.progress}
      data-tone={tone}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <div className={styles.progressFill} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

const FLAGS = ['maiz', 'jade', 'cielo', 'paper', 'maiz', 'jade'] as const;

/** Decorative band of six papel picado flags. */
export function PapelPicado() {
  const w = 60;
  return (
    <div className={styles.picado} aria-hidden="true">
      <svg viewBox={`0 0 ${w * FLAGS.length} 40`} preserveAspectRatio="none" focusable="false">
        {FLAGS.map((c, i) => (
          <path
            key={i}
            d={`M${i * w + 2} 0H${i * w + w - 2}V32L${i * w + w / 2} 40L${i * w + 2} 32Z`}
            fill={`var(--color-${c})`}
            stroke="var(--color-ink)"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}
