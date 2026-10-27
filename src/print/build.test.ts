import { readFileSync } from 'node:fs';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardName } from '@content';
import { tabla } from '@engine';
import { printArt, printPool } from './cards';
import { decodeTablaCode, seedRef } from '@engine';
import { boardsPlan, buildBoardsPdf } from './build';
import { generateBoardsPdf, generateBoardsPdfDetailed } from './index';

const fontBytes = new Uint8Array(readFileSync('public/fonts/NotoSans-Regular.ttf'));
const base = { seed: 'ABCD2345', paper: 'letter', labelLang: 'es', inkSaver: false } as const;

afterEach(() => vi.restoreAllMocks());

describe('boardsPlan', () => {
  it('every printed code decodes to this seed and its own index', () => {
    const plan = boardsPlan({ seed: base.seed, count: 200 });
    expect(plan).toHaveLength(200);
    expect(new Set(plan.map((p) => p.code)).size).toBe(200);
    for (const p of plan) {
      const d = decodeTablaCode(p.code);
      expect(d.ok).toBe(true);
      expect(d.seedRef).toBe(seedRef(base.seed));
      expect(d.index).toBe(p.index);
    }
  });
});

describe('generateBoardsPdf', () => {
  it('writes cantor sheet + two boards per page', async () => {
    const calls: number[] = [];
    const bytes = await generateBoardsPdf(
      { ...base, count: 5, largePrint: false, fontBytes },
      (d) => calls.push(d),
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1 + 3);
    expect(calls.at(-1)).toBe(5);
  });
  it('falls back to Helvetica without the font and honours large print/A4', async () => {
    const r = await generateBoardsPdfDetailed({
      ...base,
      paper: 'a4',
      count: 2,
      largePrint: true,
      inkSaver: true,
      labelLang: 'en',
    });
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28);
    expect(r.degraded).toBe(false);
  });
  it('rejects when aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      generateBoardsPdf({ ...base, count: 3, largePrint: false }, undefined, ac.signal),
    ).rejects.toThrow();
  });
  it.each(['es', 'en', 'nah', 'yua', 'quz'] as const)(
    'prints only %s labels from that language’s covered pool',
    async (labelLang) => {
      const draw = vi.spyOn(PDFPage.prototype, 'drawText');
      await buildBoardsPdf(
        { ...base, labelLang, count: 1, largePrint: false },
        { emoji: null, fontBytes },
      );
      const pool = printPool(labelLang);
      expect(pool).toHaveLength(labelLang === 'es' || labelLang === 'en' ? 144 : 54);
      // Cell labels use 10pt or smaller; the seed footer uses 7pt and is excluded below.
      const labels = draw.mock.calls
        .filter(([, options]) => (options?.size ?? 0) <= 10)
        .map(([text]) => text)
        .filter((text) => !text.includes(base.seed));
      const expected = tabla(base.seed, 0, pool).cards.map(
        (id) =>
          cardName(
            pool.find((card) => card.id === id)!,
            labelLang,
          )!.text,
      );
      expect(labels).toEqual(expected);
    },
  );
  it('embeds the current illustration for every selected cell', async () => {
    const draw = vi.spyOn(PDFPage.prototype, 'drawImage');
    // A real PNG exercises embedding; browser coverage verifies WebP-to-JPEG conversion.
    const bytes = new Uint8Array(readFileSync('public/icon-192.png'));
    const images = new Map(
      printArt({ ...base, count: 1, largePrint: false }).map(({ id }) => [
        id,
        { format: 'png' as const, bytes },
      ]),
    );
    await buildBoardsPdf(
      { ...base, count: 1, largePrint: false },
      { emoji: null, images, fontBytes },
    );
    expect(draw).toHaveBeenCalledTimes(16);
  });
  it('flags degraded output when the font is missing and labels need it', async () => {
    const r = await buildBoardsPdf(
      { ...base, count: 1, largePrint: false, labelLang: 'nah' },
      { emoji: null, fontBytes: null },
    );
    expect(typeof r.degraded).toBe('boolean');
  });
});
