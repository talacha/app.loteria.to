import CardFace from './CardFace';
import styles from './ui.module.css';

/** Shared picture adapter: printed illustration, SVG, then the card emoji. */
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
  return (
    <CardFace
      key={id}
      cardId={id}
      size="cell"
      showName={false}
      emoji={emoji}
      className={className ?? styles.art}
      emojiClassName={emojiClassName ?? styles.artEmoji}
    />
  );
}
