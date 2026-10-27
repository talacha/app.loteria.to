import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import type { Lang } from '@engine';
import CardArt from './CardArt';
import { Pill, ReviewTag, type PillTone } from './badges';
import { PaperCard, Panel, ProgressBar } from './surfaces';
import styles from './ui.module.css';

/** One selectable language (radio). Wrap several in role="radiogroup". */
export function LanguageCard({
  lang,
  name,
  native,
  sample,
  review,
  selected,
  onSelect,
  disabled,
}: {
  lang: Lang;
  name: string;
  native?: string;
  /** Sample word shown in «guillemets». */
  sample?: string;
  review?: boolean;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className={styles.langCard}
      style={{ '--lang-color': `var(--lang-${lang})` } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className={styles.langSwatch} aria-hidden="true">
        <CardArt id="sol" emoji="☀️" />
      </span>
      <span className={styles.langBody}>
        <span className={styles.langName}>{name}</span>
        {native || sample ? (
          <span className={styles.langSample}>
            {native}
            {native && sample ? ' · ' : ''}
            {sample ? `«${sample}»` : ''}
          </span>
        ) : null}
        {review ? <ReviewTag variant="word" /> : null}
      </span>
      <span className={styles.radio} aria-hidden="true">
        {selected ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

/** Five maiz tiles with the room code. */
export function RoomCodeTiles({ code, label }: { code: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.tiles}>
      <span className={styles.tilesLabel}>{label ?? t('theme.kit.room')}</span>
      <div
        className={styles.tilesRow}
        role="img"
        aria-label={t('theme.kit.roomCode', { code: [...code].join(' ') })}
      >
        {[...code].map((c, i) => (
          <span key={i} className={styles.codeTile} aria-hidden="true">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A person in the roster: glyph well, name, detail line. */
export function RosterTile({
  name,
  glyph,
  detail,
  self,
}: {
  name: string;
  glyph: ReactNode;
  detail?: string;
  self?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.roster} data-self={self ? 'true' : 'false'}>
      <span className={styles.well} aria-hidden="true">
        {glyph}
      </span>
      <span className={styles.rosterText}>
        <span className={styles.rosterName}>
          {self ? `${t('theme.kit.you')} · ` : ''}
          {name}
        </span>
        {detail ? <span className={styles.rosterDetail}>{detail}</span> : null}
      </span>
    </div>
  );
}

/** The automatic cantor's call: speaker button, word, review tag, timer. */
export function CallPanel({
  word,
  listening,
  review,
  progress,
  onReplay,
}: {
  word: string;
  /** Escucha mode: the word is replaced by "Escucha…". */
  listening?: boolean;
  review?: 'word' | 'ai';
  /** 0..1 elapsed time; omit to hide the bar. */
  progress?: number;
  onReplay?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Panel className={styles.call}>
      <button
        type="button"
        className={styles.speaker}
        onClick={onReplay}
        aria-label={t('theme.kit.replay')}
      >
        <svg
          aria-hidden="true"
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
        </svg>
      </button>
      <div className={styles.callBody}>
        <span className={styles.callLabel}>{t('theme.kit.caller')}</span>
        <div className={styles.callWord} aria-live="polite">
          {listening ? t('theme.kit.listening') : word}
        </div>
        {review && !listening ? <ReviewTag variant={review} /> : null}
      </div>
      {progress !== undefined ? (
        <div className={styles.callTimer}>
          <ProgressBar value={progress} label={t('theme.kit.progress')} />
        </div>
      ) : null}
    </Panel>
  );
}

export type ChoiceState = 'idle' | 'correct' | 'wrong';

/** Picture-only answer tile. `label` is the accessible name (the card's name). */
export function ChoiceTile({
  id,
  emoji,
  label,
  state = 'idle',
  disabled,
  onChoose,
}: {
  id: string;
  emoji: string;
  label: string;
  state?: ChoiceState;
  disabled?: boolean;
  onChoose?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.choice}
      data-state={state}
      disabled={disabled || state === 'wrong'}
      aria-label={state === 'idle' ? label : `${label} · ${t(`theme.kit.${state}`)}`}
      onClick={onChoose}
    >
      <CardArt id={id} emoji={emoji} className={styles.art} emojiClassName={styles.choiceEmoji} />
      {state === 'correct' ? (
        <span className={styles.check} aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
        </span>
      ) : null}
      {state === 'wrong' ? (
        <span className={styles.cross} aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

/** Live feedback: neutral, ok (¡Eso!) or casi (¡Casi!). Never red. */
export function FeedbackStrip({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'ok' | 'casi';
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.feedback} data-tone={tone} role="status">
      {title ? <span className={styles.feedbackTitle}>{title}</span> : null}
      {children ? <span className={styles.feedbackText}>{children}</span> : null}
    </div>
  );
}

export interface CellData {
  id: string;
  emoji: string;
  label: string;
  marked?: boolean;
  winning?: boolean;
}

/** One tabla cell: a toggle button when `onToggle` is given, else a static cell. */
export function TablaCell({ cell, onToggle }: { cell: CellData; onToggle?: () => void }) {
  const { t } = useTranslation();
  const body = (
    <>
      <CardArt
        id={cell.id}
        emoji={cell.emoji}
        className={styles.cellArt}
        emojiClassName={styles.cellEmoji}
      />
      <span className={styles.cellLabel}>{cell.label}</span>
      {cell.marked ? <span className={styles.bean} aria-hidden="true" /> : null}
    </>
  );
  const data = {
    'data-marked': cell.marked ? 'true' : 'false',
    'data-winning': cell.winning ? 'true' : 'false',
  };
  if (onToggle) {
    return (
      <li>
        <button
          type="button"
          className={styles.cell}
          style={{ width: '100%' }}
          aria-pressed={!!cell.marked}
          onClick={onToggle}
          {...data}
        >
          {body}
        </button>
      </li>
    );
  }
  return (
    <li className={styles.cell} {...data}>
      {body}
      {cell.marked ? <span className="sr-only">{t('theme.kit.marked')}</span> : null}
    </li>
  );
}

/** The 4x4 board. Pass `onToggle` to make cells tappable. */
export function Tabla({
  cells,
  onToggle,
  label,
}: {
  cells: CellData[];
  onToggle?: (id: string) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className={styles.tabla} aria-label={label ?? t('theme.kit.tabla')}>
      {cells.map((cell) => (
        <TablaCell
          key={cell.id}
          cell={cell}
          onToggle={onToggle ? () => onToggle(cell.id) : undefined}
        />
      ))}
    </ul>
  );
}

/** Light margin around the code, in modules (QR spec: at least 4). */
export const QR_QUIET = 4;

function QrSvg({ value }: { value: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const cells: string[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.modules.data[r * n + c]) cells.push(`M${c} ${r}h1v1h-1z`);
  return (
    <svg
      viewBox={`${-QR_QUIET} ${-QR_QUIET} ${n + 2 * QR_QUIET} ${n + 2 * QR_QUIET}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={value}
      focusable="false"
    >
      <rect
        x={-QR_QUIET}
        y={-QR_QUIET}
        width={n + 2 * QR_QUIET}
        height={n + 2 * QR_QUIET}
        fill="var(--color-white)"
      />
      <path d={cells.join('')} fill="var(--color-ink)" />
    </svg>
  );
}

/** QR + code on a paper card. */
export function QrCard({ url, code, caption }: { url: string; code: string; caption?: string }) {
  const { t } = useTranslation();
  return (
    <PaperCard size="lg" className={styles.qr}>
      <div className={styles.qrBox}>
        <QrSvg value={url} />
      </div>
      <span className={styles.qrCaption}>{caption ?? t('theme.kit.joinAt')}</span>
      <span className={styles.qrCode}>{code}</span>
    </PaperCard>
  );
}

/** Big called word for the caller screen, one per room language. */
export function WordCard({
  word,
  langName,
  tone,
  review,
  verse,
}: {
  word: string;
  langName: string;
  tone: PillTone;
  review?: 'word' | 'ai';
  verse?: string;
}) {
  return (
    <PaperCard size="lg" className={styles.word}>
      <Pill tone={tone}>{langName}</Pill>
      <div className={styles.wordText}>{word}</div>
      {review ? <ReviewTag variant={review} /> : null}
      {verse ? <p className={styles.verse}>{verse}</p> : null}
    </PaperCard>
  );
}

/** "Ya cantadas": recent cards as small picture tiles. */
export function HistoryStrip({
  items,
  title,
}: {
  items: { id: string; emoji: string; label: string }[];
  title?: string;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.history}>
      <h2 className={styles.historyTitle} style={{ margin: 0, fontSize: 'var(--text-base)' }}>
        {title ?? t('theme.kit.history')}
      </h2>
      <ul className={styles.historyRow}>
        {items.map((it) => (
          <li key={it.id} className={styles.historyTile} title={it.label}>
            <CardArt
              id={it.id}
              emoji={it.emoji}
              className={styles.art}
              emojiClassName={undefined}
            />
            <span className="sr-only">{it.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
