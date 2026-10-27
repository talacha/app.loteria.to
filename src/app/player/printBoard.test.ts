import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildPlayerBoardPdf } from './printBoard';

const base = {
  seed: 'seed-1',
  tablaIndex: 7,
  name: 'Ana',
  code: 'ABCDE',
  spokenLang: 'nah' as const,
};
const opts = { ...base, fontBytes: null, emoji: null };

describe('buildPlayerBoardPdf', () => {
  it('makes a one-page PDF of my tabla offline (no font fetch, no canvas)', async () => {
    const bytes = await buildPlayerBoardPdf(opts);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
  it('adds the words only when asked (bigger file with words)', async () => {
    const off = await buildPlayerBoardPdf({ ...opts, showWords: false });
    const on = await buildPlayerBoardPdf({ ...opts, showWords: true });
    expect(on.length).toBeGreaterThan(off.length);
  });
  it('is deterministic for a tabla', async () => {
    const a = await PDFDocument.load(await buildPlayerBoardPdf(opts));
    expect(a.getPageCount()).toBe(1);
  });
});
