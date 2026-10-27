import { useState } from 'react';
import styles from './ui.module.css';

/** Card picture: /art/<id>.svg, falling back to the card's emoji (card.art) if the file is missing. */
export default function CardArt({
  id,
  emoji,
  className,
  emojiClassName,
}: {
  id: string;
  emoji: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={emojiClassName ?? styles.artEmoji} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return (
    <img
      className={className ?? styles.art}
      src={`/art/${id}.svg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
