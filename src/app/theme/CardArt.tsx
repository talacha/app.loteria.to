import { useState } from 'react';

/** Card picture: /art/<id>.svg, falling back to the card's emoji if the file is missing. */
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
      <span className={emojiClassName} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return (
    <img
      className={className}
      src={`/art/${id}.svg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
