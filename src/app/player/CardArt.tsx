import { useState } from 'react';
import { getCard } from '@content';

export interface CardArtProps {
  cardId: string;
  className?: string;
}

/** Card picture from /art/<id>.svg, falling back to the card emoji if it fails to load. */
export default function CardArt({ cardId, className }: CardArtProps) {
  const [failed, setFailed] = useState(false);
  const card = getCard(cardId);
  if (failed) {
    return (
      <span className={className} aria-hidden="true" style={{ fontSize: '2.2em', lineHeight: 1 }}>
        {card?.emoji ?? card?.art ?? '?'}
      </span>
    );
  }
  return (
    <img
      className={className}
      src={`/art/${cardId}.svg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
