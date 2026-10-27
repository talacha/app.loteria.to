import { useState } from 'react';
import { getCard } from '@content';
import { cardArtEntry, cardArtUrl } from './cardArt';
import styles from './CardFace.module.css';

export type CardFaceSize = 'cell' | 'card' | 'hero';
export type CardFaceState = 'normal' | 'crossed' | 'winning' | 'dimmed';

/**
 * A card picture. With an illustration (public/cards/<id>.webp) it is the printed look: paper
 * border, thin ink frame, full-bleed art, number top-left, NAME IN CAPS at the bottom. Without
 * one, the SVG icon sits centred on a token background. 'cell' is the bare picture, cropped to
 * fill its (square) box: no frame, no number, no name.
 */
export default function CardFace({
  cardId,
  name,
  number,
  size,
  state = 'normal',
  showName = true,
  loading = 'lazy',
  priority = false,
  lang,
  className,
}: {
  cardId: string;
  /** Localized name, shown in capitals; also the alt text when it is not shown as text. */
  name?: string;
  number?: number;
  size: CardFaceSize;
  state?: CardFaceState;
  showName?: boolean;
  loading?: 'lazy' | 'eager';
  /** fetchpriority="high" (the current called card). */
  priority?: boolean;
  lang?: string;
  className?: string;
}) {
  const url = cardArtUrl(cardId);
  const entry = cardArtEntry(cardId);
  const [artFailed, setArtFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const withArt = !!url && !artFailed;
  const cell = size === 'cell';
  const nameShown = !cell && showName && !!name;
  const framed = !cell;
  const emoji = getCard(cardId)?.art ?? '';

  const picture = withArt ? (
    <img
      className={styles.art}
      src={url}
      srcSet={`${url} 1x`}
      width={entry?.width}
      height={entry?.height}
      alt={nameShown ? '' : (name ?? '')}
      loading={loading}
      decoding="async"
      // eslint-disable-next-line react/no-unknown-property
      {...(priority ? { fetchpriority: 'high' } : {})}
      onError={() => setArtFailed(true)}
    />
  ) : iconFailed ? (
    <span className={styles.emoji} aria-hidden="true">
      {emoji}
    </span>
  ) : (
    <img
      className={styles.icon}
      src={`/art/${cardId}.svg`}
      alt={nameShown ? '' : (name ?? '')}
      loading={loading}
      decoding="async"
      onError={() => setIconFailed(true)}
    />
  );

  return (
    <div
      className={`${styles.face} ${className ?? ''}`}
      data-size={size}
      data-state={state}
      data-art={withArt ? 'true' : 'false'}
    >
      <div className={styles.frame}>
        {picture}
        {framed && number !== undefined ? <span className={styles.num}>{number}</span> : null}
        {nameShown ? (
          <span className={styles.name} lang={lang}>
            {name}
          </span>
        ) : null}
      </div>
      {state === 'crossed' ? <span className={styles.bean} aria-hidden="true" /> : null}
    </div>
  );
}
