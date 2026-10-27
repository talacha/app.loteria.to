import { useState } from 'react';
import type { Card } from '@content';

/** Card picture from /art/<id>.svg, falling back to the emoji placeholder. */
export default function CardArt({
  card,
  alt = '',
  className,
}: {
  card: Card;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <span aria-hidden="true">{card.art}</span>
      </span>
    );
  }
  return (
    <img
      className={className}
      src={`/art/${card.id}.svg`}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
