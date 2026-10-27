import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/theme/tokens.css', 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[m[1] as string] = (m[2] as string).trim().toLowerCase();
  }
  return out;
}

function resolve(vars: Record<string, string>): Record<string, string> {
  const get = (k: string, depth = 0): string => {
    const v = vars[k] ?? '';
    const m = /^var\(--([\w-]+)\)$/.exec(v);
    return m && depth < 8 ? get(m[1] as string, depth + 1) : v;
  };
  return Object.fromEntries(Object.keys(vars).map((k) => [k, get(k)]));
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

const base = block(':root {');
const themes: Record<string, Record<string, string>> = {
  night: resolve(base),
  contrast: resolve({ ...base, ...block(":root[data-theme='contrast']") }),
};

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ['paper', 'night', 4.5],
  ['paper', 'night-raised', 4.5],
  ['muted-night', 'night', 4.5],
  ['muted-night', 'night-raised', 4.5],
  ['ink', 'paper', 4.5],
  ['muted-paper', 'paper', 4.5],
  ['ink', 'maiz', 4.5],
  ['ink', 'review', 4.5],
  ['maiz', 'night', 4.5],
  ['maiz', 'night-raised', 4.5],
  ['color-ink', 'color-bg', 4.5],
  ['color-ink', 'color-surface', 4.5],
  ['color-ink-muted', 'color-bg', 4.5],
  ['color-ink-muted', 'color-surface', 4.5],
  ['color-ink', 'color-warn-bg', 4.5],
  ['color-accent-ink', 'color-accent', 4.5],
  ['color-accent', 'color-bg', 4.5],
  ['color-jade', 'color-surface', 4.5],
  ['color-cielo', 'color-surface', 4.5],
  ['color-focus', 'color-bg', 3],
  ['color-focus', 'color-surface', 3],
  ['line-night', 'night', 1],
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

const SHARED_NAMES = [
  'night',
  'night-raised',
  'night-line',
  'ink',
  'paper',
  'card-white',
  'shadow-color',
  'shadow-hard',
  'muted-on-night',
  'muted-on-paper',
  'maiz',
  'rosa',
  'jade',
  'cielo',
  'lang-maya',
  'lang-quechua',
  'chile',
  'review',
  'bean',
  'lang-nah',
  'lang-yua',
  'lang-quz',
  'lang-es',
  'lang-en',
  'font-display',
  'font-ui',
  'border-thick',
  'border-thin',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-pill',
  'press-offset',
];

describe('shared token names', () => {
  it.each(SHARED_NAMES)('defines --%s', (name) => {
    expect(base[name], name).toBeTruthy();
  });
  it('keeps the design colours', () => {
    expect(base['lang-maya']).toBe('#7a4bd6');
    expect(base['shadow-hard']).toBe('0 5px 0 var(--shadow-color)');
  });
});
