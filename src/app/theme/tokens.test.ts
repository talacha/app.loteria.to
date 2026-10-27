import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/theme/tokens.css', 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    out[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return out;
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(':root {');
const themes: Record<string, Record<string, string>> = {
  light,
  dark: { ...light, ...block(":root:not([data-theme='light'])") },
  contrast: { ...light, ...block(":root[data-theme='contrast']") },
};

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ['color-ink', 'color-bg', 4.5],
  ['color-ink', 'color-surface', 4.5],
  ['color-ink-muted', 'color-bg', 4.5],
  ['color-ink-muted', 'color-surface', 4.5],
  ['color-ink', 'color-warn-bg', 4.5],
  ['color-accent-ink', 'color-accent', 4.5],
  ['color-accent', 'color-bg', 4.5],
  ['color-accent', 'color-surface', 4.5],
  ['color-focus', 'color-bg', 3],
  ['color-focus', 'color-surface', 3],
  ['color-ink-muted', 'color-surface', 3], // input borders
];

describe('token contrast', () => {
  for (const [name, t] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${name}: ${fg} on ${bg} >= ${min}`, () => {
        expect(t[fg], fg).toBeTruthy();
        expect(t[bg], bg).toBeTruthy();
        expect(ratio(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
