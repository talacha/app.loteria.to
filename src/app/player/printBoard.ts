import type { CardId, Lang } from '@engine';
import { tabla, tablaCode } from '@engine';
import { cards } from '@content';
import { canvasAvailable, renderEmojiPngs } from '../../print/emoji';
import { hasUnsupported, stripUnsupported } from '../../print/layout';
import { wordOf } from './words';

export interface PlayerPdfOptions {
  seed: string;
  tablaIndex: number;
  name: string;
  code: string;
  spokenLang: Lang;
  /** Print the words in the spoken language under each picture (default off). */
  showWords?: boolean;
  /** Overrides for tests / offline. */
  fontBytes?: Uint8Array | null;
  emoji?: Map<string, Uint8Array> | null;
}

async function fetchFont(): Promise<Uint8Array | null> {
  try {
    const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
    const res = await fetch(`${base}fonts/NotoSans-Regular.ttf`);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** One-page PDF of MY assigned 4x4 cartón. pdf-lib loads lazily; works offline (font ships in /fonts). */
export async function buildPlayerBoardPdf(o: PlayerPdfOptions): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Lotería de los Pueblos');
  pdf.setCreator('app.loteria.to');
  const fontBytes = o.fontBytes === undefined ? await fetchFont() : o.fontBytes;
  let font;
  let safe = (s: string) => s;
  try {
    if (!fontBytes) throw new Error('no font');
    const fontkit = (await import('@pdf-lib/fontkit')).default;
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(fontBytes, { subset: true });
  } catch {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    safe = stripUnsupported;
  }
  const emoji =
    o.emoji !== undefined
      ? o.emoji
      : canvasAvailable()
        ? await renderEmojiPngs(cards.map((c) => ({ id: c.id, art: c.art })))
        : null;

  const ids: CardId[] = tabla(o.seed, o.tablaIndex, cards).cards;
  const W = 612;
  const H = 792;
  const page = pdf.addPage([W, H]);
  const ink = rgb(0.16, 0.1, 0.06);
  const centered = (text: string, size: number, cx: number, y: number) => {
    const t = safe(text);
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color: ink });
  };
  centered('Lotería de los Pueblos', 22, W / 2, H - 56);
  centered(`${o.name} · ${o.code} · ${tablaCode(o.seed, o.tablaIndex)}`, 14, W / 2, H - 80);

  const margin = 48;
  const side = (W - margin * 2) / 4;
  const top = H - 110;
  for (let i = 0; i < 16; i++) {
    const id = ids[i] as CardId;
    const x = margin + (i % 4) * side;
    const y = top - (Math.floor(i / 4) + 1) * side;
    page.drawRectangle({ x, y, width: side, height: side, borderColor: ink, borderWidth: 1.5 });
    const label = o.showWords ? wordOf(id, o.spokenLang) : '';
    const labelH = o.showWords ? 22 : 0;
    const pic = side - 16 - labelH;
    const bytes = emoji?.get(id);
    if (bytes) {
      try {
        const img = await pdf.embedPng(bytes);
        page.drawImage(img, {
          x: x + (side - pic) / 2,
          y: y + 8 + labelH,
          width: pic,
          height: pic,
        });
      } catch {
        /* picture missing: leave the square empty */
      }
    }
    if (o.showWords) {
      let size = 13;
      while (size > 7 && font.widthOfTextAtSize(safe(label), size) > side - 8) size -= 1;
      centered(label, size, x + side / 2, y + 8);
    }
  }
  return pdf.save();
}

/** True when the spoken-language words cannot all be drawn by the fallback font. */
export function wordsNeedFont(lang: Lang, ids: CardId[]): boolean {
  return ids.some((id) => hasUnsupported(wordOf(id, lang)));
}
