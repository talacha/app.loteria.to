import type { Lang } from '@engine';

/** Pure layout math for printed boards. All units are PDF points, origin bottom-left. */
export type Paper = 'letter' | 'a4';

export interface PrintOptions {
  seed: string;
  /** 1..MAX_BOARDS */
  count: number;
  paper: Paper;
  labelLang: Lang;
  /** One board per page with bigger type (otherwise two per page). */
  largePrint: boolean;
  /** No fills, thin lines. */
  inkSaver: boolean;
  /** Used for the optional QR on the cantor sheet (`${origin}/r/`). */
  origin?: string;
  /** Test/offline override for the font file. */
  fontBytes?: Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_BOARDS = 200;
export const GRID = 4;
export const MARGIN = 36;
export const BOARD_GAP = 20;

export const PAPER_SIZES: Record<Paper, { w: number; h: number }> = {
  letter: { w: 612, h: 792 },
  a4: { w: 595.28, h: 841.89 },
};

export function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_BOARDS, Math.max(1, Math.trunc(n)));
}

export function boardsPerPage(largePrint: boolean): number {
  return largePrint ? 1 : 2;
}

/** Board pages only (the cantor sheet adds one more). */
export function boardPageCount(count: number, largePrint: boolean): number {
  return Math.ceil(clampCount(count) / boardsPerPage(largePrint));
}

/** Rectangle of the board in the given slot (0 = top) on a page. */
export function boardRect(paper: Paper, largePrint: boolean, slot: number): Rect {
  const { w, h } = PAPER_SIZES[paper];
  const per = boardsPerPage(largePrint);
  if (!Number.isInteger(slot) || slot < 0 || slot >= per) {
    throw new RangeError(`slot must be an integer in 0..${per - 1}`);
  }
  const bw = w - 2 * MARGIN;
  const bh = (h - 2 * MARGIN - (per - 1) * BOARD_GAP) / per;
  return { x: MARGIN, y: h - MARGIN - (slot + 1) * bh - slot * BOARD_GAP, w: bw, h: bh };
}

/** Height reserved at the bottom of a board for the big check code and the seed. */
export function footerHeight(largePrint: boolean): number {
  return largePrint ? 96 : 56;
}

export function gridRect(board: Rect, largePrint: boolean): Rect {
  const f = footerHeight(largePrint);
  return { x: board.x, y: board.y + f, w: board.w, h: board.h - f };
}

/** Cell (row 0 = top, col 0 = left) of the 4x4 grid. */
export function cellRect(grid: Rect, row: number, col: number): Rect {
  if (row < 0 || row >= GRID || col < 0 || col >= GRID) throw new RangeError('cell out of range');
  const cw = grid.w / GRID;
  const ch = grid.h / GRID;
  return { x: grid.x + col * cw, y: grid.y + grid.h - (row + 1) * ch, w: cw, h: ch };
}

/** Square emoji box centred horizontally in the upper part of a cell, leaving room for the label. */
export function pictureRect(cell: Rect, labelHeight: number, pad: number): Rect {
  const availH = cell.h - labelHeight - 2 * pad;
  const size = Math.max(0, Math.min(availH, cell.w - 2 * pad));
  return {
    x: cell.x + (cell.w - size) / 2,
    y: cell.y + labelHeight + pad + (availH - size) / 2,
    w: size,
    h: size,
  };
}

export function labelFontSize(largePrint: boolean): number {
  return largePrint ? 18 : 10;
}

/** Greedy word wrap using a caller-provided width measure. */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next) > maxWidth) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Largest size in [min, max] (0.5 steps) at which the text fits in maxLines lines. */
export function fitLabel(
  text: string,
  maxWidth: number,
  maxLines: number,
  max: number,
  min: number,
  measureAt: (s: string, size: number) => number,
): { size: number; lines: string[] } {
  for (let size = max; size >= min; size -= 0.5) {
    const lines = wrapLines(text, maxWidth, (s) => measureAt(s, size));
    const widest = Math.max(0, ...lines.map((l) => measureAt(l, size)));
    if (lines.length <= maxLines && widest <= maxWidth) return { size, lines };
  }
  return {
    size: min,
    lines: wrapLines(text, maxWidth, (s) => measureAt(s, min)).slice(0, maxLines),
  };
}

const APOSTROPHES = /[\u02BC\u2019]/g;

/** True when a standard font would lose characters of this text (apostrophes are mapped, not lost). */
export function hasUnsupported(text: string): boolean {
  for (const ch of text.normalize('NFC').replace(APOSTROPHES, "'")) {
    if (stripUnsupported(ch) !== ch) return true;
  }
  return false;
}

/** Keep only characters a standard (WinAnsi/Latin-1) font can draw, used when Noto is unavailable. */
export function stripUnsupported(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC').replace(APOSTROPHES, "'")) {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0x20 && cp <= 0xff && !(cp >= 0x7f && cp <= 0x9f)) {
      out += ch;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base && [...base].every((c) => (c.codePointAt(0) as number) <= 0xff)) out += base;
  }
  return out;
}
