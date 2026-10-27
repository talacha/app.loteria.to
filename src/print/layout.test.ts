import { describe, expect, it } from 'vitest';
import {
  BOARD_GAP,
  MARGIN,
  PAPER_SIZES,
  boardPageCount,
  boardRect,
  cellRect,
  clampCount,
  fitLabel,
  gridRect,
  pictureRect,
  hasUnsupported,
  stripUnsupported,
  wrapLines,
} from './layout';
import { newSeed, normalizePrintSeed, parseSeed } from './seed';

describe('layout math', () => {
  it('clamps counts to 1..200', () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(999)).toBe(200);
    expect(clampCount(7.9)).toBe(7);
    expect(clampCount(NaN)).toBe(1);
  });
  it('counts pages', () => {
    expect(boardPageCount(5, false)).toBe(3);
    expect(boardPageCount(5, true)).toBe(5);
    expect(boardPageCount(200, false)).toBe(100);
  });
  it('places boards inside the margins without overlap', () => {
    for (const paper of ['letter', 'a4'] as const) {
      const { w, h } = PAPER_SIZES[paper];
      const a = boardRect(paper, false, 0);
      const b = boardRect(paper, false, 1);
      expect(a.y).toBeGreaterThan(b.y + b.h);
      expect(a.y - (b.y + b.h)).toBeCloseTo(BOARD_GAP);
      expect(a.y + a.h).toBeCloseTo(h - MARGIN);
      expect(b.y).toBeCloseTo(MARGIN);
      expect(a.x + a.w).toBeCloseTo(w - MARGIN);
      const one = boardRect(paper, true, 0);
      expect(one.h).toBeCloseTo(h - 2 * MARGIN);
      expect(() => boardRect(paper, true, 1)).toThrow(RangeError);
    }
  });
  it('tiles the grid into 16 cells', () => {
    const grid = gridRect(boardRect('letter', false, 0), false);
    let area = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const cell = cellRect(grid, r, c);
        area += cell.w * cell.h;
        expect(cell.x).toBeGreaterThanOrEqual(grid.x - 1e-9);
        expect(cell.y).toBeGreaterThanOrEqual(grid.y - 1e-9);
      }
    expect(area).toBeCloseTo(grid.w * grid.h);
    expect(cellRect(grid, 0, 0).y).toBeGreaterThan(cellRect(grid, 3, 0).y);
    expect(() => cellRect(grid, 4, 0)).toThrow();
  });
  it('keeps the picture inside its cell and above the label', () => {
    const cell = { x: 10, y: 20, w: 100, h: 80 };
    const p = pictureRect(cell, 24, 4);
    expect(p.w).toBe(p.h);
    expect(p.y).toBeGreaterThanOrEqual(cell.y + 24);
    expect(p.y + p.h).toBeLessThanOrEqual(cell.y + cell.h);
    expect(p.x + p.w).toBeLessThanOrEqual(cell.x + cell.w);
  });
  it('wraps and fits labels', () => {
    const measure = (s: string, size = 10) => s.length * size * 0.5;
    expect(wrapLines('El Colibrí Verde', 60, (s) => measure(s))).toEqual(['El Colibrí', 'Verde']);
    const fit = fitLabel('La Mariposa Monarca', 60, 2, 12, 6, measure);
    expect(fit.lines.length).toBeLessThanOrEqual(2);
    expect(Math.max(...fit.lines.map((l) => measure(l, fit.size)))).toBeLessThanOrEqual(60);
  });
  it('strips characters Helvetica cannot draw', () => {
    expect(stripUnsupported('El Colibrí ñ')).toBe('El Colibrí ñ');
    expect(stripUnsupported('Ā tl☀')).toBe('A tl');
    expect(stripUnsupported('Ka\u2019a Ka\u02BCa')).toBe("Ka'a Ka'a");
    expect(hasUnsupported('Ka\u2019a')).toBe(false);
    expect(hasUnsupported('Ā')).toBe(true);
    expect(hasUnsupported('El Jaguar')).toBe(false);
  });
});

describe('seeds', () => {
  it('makes 8-char Crockford seeds', () => {
    for (let i = 0; i < 20; i++) expect(newSeed()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });
  it.each([
    ['ABCD2345', 'ABCD2345'],
    [' abcd-2345 ', 'ABCD2345'],
    ['abcd 2345', 'ABCD2345'],
    ['OBCD2345', '0BCD2345'],
    ['IBCD2345', '1BCD2345'],
    ['LBCD2345', '1BCD2345'],
    ['ABCD234', null],
    ['ABCD23456', null],
    ['ABCU2345', null],
    ['ABCD234!', null],
    ['', null],
  ])('normalizes %j to %j', (raw, want) => {
    expect(normalizePrintSeed(raw)).toBe(want);
    expect(parseSeed(raw)).toBe(want);
  });
  it('handles null/undefined', () => {
    expect(normalizePrintSeed(null)).toBeNull();
    expect(normalizePrintSeed(undefined)).toBeNull();
  });
  it('newSeed output is always valid', () => {
    for (let i = 0; i < 50; i++) expect(normalizePrintSeed(newSeed())).not.toBeNull();
  });
});
