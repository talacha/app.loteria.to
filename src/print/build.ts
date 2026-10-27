import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import es from './strings.es.json';
import en from './strings.en.json';
import { tabla, tablaCode, type Lang } from '@engine';
import { callableLangs, cardName, cards, type Card } from '@content';
import {
  GRID,
  PAPER_SIZES,
  boardRect,
  boardsPerPage,
  cellRect,
  clampCount,
  fitLabel,
  footerHeight,
  gridRect,
  labelFontSize,
  pictureRect,
  stripUnsupported,
  hasUnsupported,
  type PrintOptions,
  type Rect,
} from './layout';

export interface BuildContext {
  /** card id -> PNG bytes. Absent/empty means names only. */
  emoji: Map<string, Uint8Array> | null;
  fontBytes: Uint8Array | null;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface BuildResult {
  bytes: Uint8Array;
  /** The font failed to load and some labels contain characters the fallback cannot draw. */
  degraded: boolean;
}

/** Pure plan of the printed boards: index and 6-char check code of each. */
export function boardsPlan(
  opts: Pick<PrintOptions, 'seed' | 'count'>,
): { index: number; code: string }[] {
  return Array.from({ length: clampCount(opts.count) }, (_, index) => ({
    index,
    code: tablaCode(opts.seed, index),
  }));
}

const INK = rgb(0.16, 0.1, 0.06);
const MUTED = rgb(0.42, 0.33, 0.27);
const BORDER = rgb(0.45, 0.33, 0.24);

type Strings = typeof es;
const fill = (tpl: string, vars: Record<string, number | string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const textFor = (lang: Lang): Strings => (lang === 'en' ? en : es);

const CATEGORY_TINT: Record<string, [number, number, number]> = {
  animals: [1, 0.93, 0.85],
  plants_food: [0.9, 0.96, 0.88],
  sky: [0.88, 0.93, 1],
  land: [0.95, 0.91, 0.84],
  handmade: [0.97, 0.9, 0.93],
  places: [0.93, 0.92, 0.82],
};

function labelFor(card: Card, lang: Lang, callable: readonly Lang[]): string {
  const use: Lang = lang === 'es' || lang === 'en' || callable.includes(lang) ? lang : 'es';
  return cardName(card, use)?.text ?? cardName(card, 'es')?.text ?? card.id;
}

async function loadFont(
  pdf: PDFDocument,
  bytes: Uint8Array | null,
): Promise<{ font: PDFFont; safe: (s: string) => string; fallback: boolean }> {
  if (bytes) {
    try {
      pdf.registerFontkit(fontkit);
      const font = await pdf.embedFont(bytes, { subset: true });
      return { font, safe: (s) => s, fallback: false };
    } catch {
      /* fall through to Helvetica */
    }
  }
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  return { font, safe: stripUnsupported, fallback: true };
}

function centered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  cx: number,
  y: number,
  color = INK,
): void {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

/** Draw characters one by one with extra tracking, centred on cx. */
function spaced(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  track: number,
  cx: number,
  y: number,
): void {
  const chars = [...text];
  const widths = chars.map((c) => font.widthOfTextAtSize(c, size));
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    page.drawText(c, { x, y, size, font, color: INK });
    x += (widths[i] as number) + track;
  });
}

interface Kit {
  font: PDFFont;
  safe: (s: string) => string;
  images: Map<string, PDFImage>;
  opts: PrintOptions;
  callable: readonly Lang[];
  byId: Map<string, Card>;
}

function drawBoard(
  page: PDFPage,
  kit: Kit,
  rect: Rect,
  ids: string[],
  index: number,
  total: number,
  code: string,
): void {
  const { opts, font, safe } = kit;
  const big = opts.largePrint;
  const saver = opts.inkSaver;
  const grid = gridRect(rect, big);
  const lineW = saver ? 0.5 : 1.5;
  const labelSize = labelFontSize(big);

  ids.forEach((id, i) => {
    const row = Math.floor(i / GRID);
    const col = i % GRID;
    const cell = cellRect(grid, row, col);
    const card = kit.byId.get(id);
    const tint = CATEGORY_TINT[card?.category ?? ''] ?? [1, 1, 1];
    page.drawRectangle({
      x: cell.x,
      y: cell.y,
      width: cell.w,
      height: cell.h,
      borderColor: saver ? MUTED : BORDER,
      borderWidth: lineW,
      ...(saver ? {} : { color: rgb(tint[0], tint[1], tint[2]) }),
    });
    if (!card) return;
    const pad = big ? 8 : 4;
    const text = safe(labelFor(card, opts.labelLang, kit.callable));
    const maxLines = big ? 2 : 2;
    const fit = fitLabel(text, cell.w - 2 * pad, maxLines, labelSize, 6, (s, sz) =>
      font.widthOfTextAtSize(s, sz),
    );
    const lineH = fit.size * 1.15;
    const labelH = lineH * fit.lines.length + pad;
    const img = kit.images.get(id);
    if (img) {
      const pic = pictureRect(cell, labelH, pad);
      page.drawImage(img, { x: pic.x, y: pic.y, width: pic.w, height: pic.h });
    }
    const labelBlockTop = cell.y + pad + lineH * fit.lines.length;
    // Without a picture the label is centred in the cell.
    const topY = img
      ? labelBlockTop - fit.size
      : cell.y + cell.h / 2 + (lineH * fit.lines.length) / 2 - fit.size;
    fit.lines.forEach((line, li) => {
      centered(page, font, line, fit.size, cell.x + cell.w / 2, topY - li * lineH);
    });
  });

  const cx = rect.x + rect.w / 2;
  const codeSize = big ? 44 : 28;
  spaced(
    page,
    font,
    code,
    codeSize,
    codeSize * 0.25,
    cx,
    rect.y + footerHeight(big) - codeSize - (big ? 14 : 8),
  );
  const t = textFor(opts.labelLang);
  centered(
    page,
    font,
    safe(`${t.seed} ${opts.seed} · ${fill(t.board, { k: index + 1, n: total })}`),
    big ? 10 : 7,
    cx,
    rect.y + 6,
    MUTED,
  );
}

async function drawCantorSheet(pdf: PDFDocument, kit: Kit, total: number): Promise<void> {
  const { opts, font, safe } = kit;
  const { w, h } = PAPER_SIZES[opts.paper];
  const page = pdf.addPage([w, h]);
  const t = textFor(opts.labelLang);
  const cx = w / 2;
  let y = h - 90;
  centered(page, font, safe(t.sheetTitle), 30, cx, y);
  y -= 50;
  centered(page, font, safe(t.seedLabel), 14, cx, y, MUTED);
  y -= 54;
  spaced(page, font, opts.seed, 48, 12, cx, y);
  y -= 34;
  const help = fitLabel(safe(t.seedHelp), w - 120, 3, 12, 12, (s, sz) =>
    font.widthOfTextAtSize(s, sz),
  );
  help.lines.forEach((l, i) => centered(page, font, l, 12, cx, y - i * 16, MUTED));
  y -= help.lines.length * 16 + 20;
  centered(page, font, safe(fill(t.boards, { n: total })), 12, cx, y);
  y -= 40;
  t.steps.forEach((step, i) => {
    const lines = fitLabel(safe(`${i + 1}. ${step}`), w - 144, 3, 13, 13, (s, sz) =>
      font.widthOfTextAtSize(s, sz),
    ).lines;
    lines.forEach((l, li) => {
      page.drawText(l, { x: 72 + (li ? 14 : 0), y, size: 13, font, color: INK });
      y -= 18;
    });
    y -= 6;
  });
  if (opts.origin) {
    try {
      const url = `${opts.origin}/r/`;
      const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
      const n = qr.modules.size;
      const mod = 3;
      const size = n * mod;
      const x0 = cx - size / 2;
      const y0 = 110;
      page.drawRectangle({
        x: x0 - 8,
        y: y0 - 8,
        width: size + 16,
        height: size + 16,
        color: rgb(1, 1, 1),
      });
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (qr.modules.data[r * n + c])
            page.drawRectangle({
              x: x0 + c * mod,
              y: y0 + (n - 1 - r) * mod,
              width: mod,
              height: mod,
              color: rgb(0, 0, 0),
            });
      centered(page, font, safe(`${t.qr}: ${url}`), 10, cx, y0 - 26, MUTED);
    } catch {
      /* QR is optional */
    }
  }
}

export async function buildBoardsPdf(
  rawOpts: PrintOptions,
  ctx: BuildContext,
): Promise<BuildResult> {
  const opts: PrintOptions = { ...rawOpts, count: clampCount(rawOpts.count) };
  const pdf = await PDFDocument.create();
  pdf.setTitle('Lotería de los Pueblos');
  pdf.setCreator('app.loteria.to');
  const { font, safe, fallback } = await loadFont(pdf, ctx.fontBytes);

  const images = new Map<string, PDFImage>();
  if (ctx.emoji) {
    for (const [id, bytes] of ctx.emoji) {
      try {
        images.set(id, await pdf.embedPng(bytes));
      } catch {
        /* name only for this card */
      }
    }
  }
  const kit: Kit = {
    font,
    safe,
    images,
    opts,
    callable: callableLangs(),
    byId: new Map(cards.map((c) => [c.id, c])),
  };
  const pool = cards.map((c) => ({ id: c.id, category: c.category }));

  const callable = kit.callable;
  const degraded =
    fallback && cards.some((c) => hasUnsupported(labelFor(c, opts.labelLang, callable)));
  const plan = boardsPlan(opts);

  await drawCantorSheet(pdf, kit, opts.count);
  const per = boardsPerPage(opts.largePrint);
  const { w, h } = PAPER_SIZES[opts.paper];
  let page: PDFPage | null = null;
  for (const { index: i, code } of plan) {
    ctx.signal?.throwIfAborted();
    const slot = i % per;
    if (slot === 0) page = pdf.addPage([w, h]);
    const tab = tabla(opts.seed, i, pool);
    drawBoard(
      page as PDFPage,
      kit,
      boardRect(opts.paper, opts.largePrint, slot),
      tab.cards,
      i,
      opts.count,
      code,
    );
    ctx.onProgress?.(i + 1, opts.count);
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  return { bytes: await pdf.save(), degraded };
}
