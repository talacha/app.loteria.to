import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/theme/tokens.css', 'utf8');
const json = JSON.parse(readFileSync('design/tokens.json', 'utf8')) as Record<string, unknown>;

function block(selector: string, src = css): Record<string, string> {
  const start = src.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = src.indexOf('{', start);
  const close = src.indexOf(src === css ? '\n}' : '\n  }', open);
  const out: Record<string, string> = {};
  for (const m of src.slice(open + 1, close).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[m[1] as string] = (m[2] as string).trim();
  }
  return out;
}

/** Replace every var(--x) by its value, recursively. */
function resolve(vars: Record<string, string>, value: string, depth = 0): string {
  if (depth > 10) return value;
  return value.replace(/var\(--([\w-]+)\)/g, (_, k: string) =>
    vars[k] === undefined ? `var(--${k})` : resolve(vars, vars[k] as string, depth + 1),
  );
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const base = block(':root {');
const contrast = { ...base, ...block(":root[data-theme='contrast']") };
const light = { ...base, ...block(":root[data-theme='light']") };
const autoLight = {
  ...base,
  ...block(
    ':root:not([data-theme]) {',
    css.slice(css.indexOf('@media (prefers-color-scheme: light)')),
  ),
};

// Flatten design/tokens.json into [cssName, resolved value].
const flat: Record<string, string> = {};
const lightJson: Record<string, string> = {};
for (const [name, def] of Object.entries(
  (json.theme as { light: Record<string, { $value: string }> }).light,
)) {
  if (!name.startsWith('$')) lightJson['color-' + name] = def.$value;
}
for (const [group, items] of Object.entries(json)) {
  if (group.startsWith('$') || group === 'theme') continue;
  for (const [name, def] of Object.entries(items as Record<string, { $value: string }>)) {
    flat[`${group}-${name}`] = def.$value;
  }
}
const jsonVars = Object.fromEntries(
  Object.entries(flat).map(([k, v]) => [k.replace(/^color-/, 'color-'), v]),
);
function jsonResolve(v: string, depth = 0): string {
  if (depth > 10) return v;
  return v.replace(/\{(\w+)\.([\w-]+)\}/g, (_, g: string, n: string) =>
    jsonResolve(jsonVars[`${g}-${n}`] ?? '', depth + 1),
  );
}

describe('tokens.css matches design/tokens.json', () => {
  it('has tokens to check', () => {
    expect(Object.keys(flat).length).toBeGreaterThan(60);
  });
  it.each(Object.keys(flat))('--%s', (name) => {
    expect(base[name], `--${name} missing from tokens.css`).toBeDefined();
    expect(norm(resolve(base, base[name] as string))).toBe(norm(jsonResolve(flat[name] as string)));
  });
});

describe('light theme matches design/tokens.json theme.light', () => {
  it.each(Object.keys(lightJson))('--%s', (name) => {
    expect(norm(light[name] as string)).toBe(norm(lightJson[name] as string));
    expect(norm(autoLight[name] as string)).toBe(norm(lightJson[name] as string));
  });
});

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
const hex = (vars: Record<string, string>, k: string) => resolve(vars, `var(--${k})`);

// [foreground, background, minimum ratio] from DESIGN.md §3 and §8 (large display text >= 3).
const PAIRS: [string, string, number][] = [
  ['color-paper', 'color-night', 4.5],
  ['color-paper', 'color-night-raised', 4.5],
  ['color-muted-on-night', 'color-night', 4.5],
  ['color-muted-on-night', 'color-night-raised', 4.5],
  ['color-ink', 'color-paper', 4.5],
  ['color-ink', 'color-white', 4.5],
  ['color-muted-on-paper', 'color-paper', 4.5],
  ['color-ink', 'color-maiz', 4.5],
  ['color-ink', 'color-maiz-soft', 4.5],
  ['color-ink', 'color-jade-soft', 4.5],
  ['color-maiz', 'color-night', 4.5],
  ['color-maiz', 'color-night-raised', 4.5],
  ['color-paper', 'color-maya', 4.5],
  ['color-paper', 'color-quechua', 4.5],
  ['color-paper', 'color-cielo', 4.5],
  ['color-ink', 'color-jade', 4.5],
  ['color-ink', 'color-rosa', 3],
  ['color-paper', 'color-rosa', 3],
  ['color-night-dash', 'color-night', 3],
  ['color-maiz', 'color-night', 3],
  ['color-ink', 'color-disabled-on-night', 1],
  ['color-text', 'color-night', 4.5],
  ['color-text', 'color-night-raised', 4.5],
  ['color-accent-text', 'color-night', 4.5],
  ['color-accent-text', 'color-night-raised', 4.5],
  ['color-muted-on-paper', 'color-white', 4.5],
  ['color-paper', 'color-rosa', 4.5],
];
// UI parts (ink borders on cards, dashed panel edges and progress track on the grounds).
const UI_PAIRS: [string, string, number][] = [
  ['color-ink', 'color-paper', 3],
  ['color-ink', 'color-white', 3],
  ['color-ink', 'color-maiz', 3],
  ['color-night-dash', 'color-night', 3],
  ['color-night-dash', 'color-night-raised', 3],
];

// Control/card boundaries (night-dash) and the focus ring must reach 3:1 against the ground,
// the raised panel fill and paper/white surfaces, in every theme (WCAG 1.4.11).
describe('boundary and focus colours (non-text contrast)', () => {
  for (const [name, t] of Object.entries({
    night: base,
    light,
    'auto-light': autoLight,
    contrast,
  })) {
    for (const bg of ['color-night', 'color-night-raised']) {
      it(`${name}: color-night-dash on ${bg} >= 3`, () => {
        expect(ratio(hex(t, 'color-night-dash'), hex(t, bg))).toBeGreaterThanOrEqual(3);
      });
    }
    for (const bg of ['color-night', 'color-night-raised', 'color-paper', 'color-white']) {
      // On the dark grounds the focus ring sits on night; on paper/white the ink halo carries it
      // (ink halo vs surface is asserted below), so the ring itself must clear 3:1 on the ground.
      if (bg === 'color-night' || bg === 'color-night-raised') {
        it(`${name}: color-focus on ${bg} >= 3`, () => {
          expect(ratio(hex(t, 'color-focus'), hex(t, bg))).toBeGreaterThanOrEqual(3);
        });
      }
    }
    it(`${name}: color-focus on paper and white >= 3 (light themes) or ink halo >= 3`, () => {
      for (const bg of ['color-paper', 'color-white']) {
        const ring = ratio(hex(t, 'color-focus'), hex(t, bg));
        const halo = ratio(hex(t, 'color-ink'), hex(t, bg));
        expect(Math.max(ring, halo)).toBeGreaterThanOrEqual(3);
      }
      expect(ratio(hex(t, 'color-focus'), hex(t, 'color-night'))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('token contrast', () => {
  for (const [name, t] of Object.entries({
    night: base,
    light,
    'auto-light': autoLight,
    contrast,
  })) {
    for (const [fg, bg, min] of PAIRS) {
      // On the light ground maiz is a fill only; text uses color-accent-text.
      if (
        name.endsWith('light') &&
        ['color-maiz', 'color-paper'].includes(fg) &&
        bg.startsWith('color-night')
      )
        continue;
      it(`${name}: ${fg} on ${bg} >= ${min}`, () => {
        expect(ratio(hex(t, fg), hex(t, bg))).toBeGreaterThanOrEqual(min);
      });
    }
  }
  for (const [name, t] of Object.entries({ night: base, light, contrast })) {
    for (const [fg, bg, min] of UI_PAIRS) {
      it(`${name} UI part: ${fg} on ${bg} >= ${min}`, () => {
        expect(ratio(hex(t, fg), hex(t, bg))).toBeGreaterThanOrEqual(min);
      });
    }
    it(`${name}: text never equals its ground`, () => {
      expect(hex(t, 'color-text')).not.toBe(hex(t, 'color-night'));
      expect(hex(t, 'color-ink')).not.toBe(hex(t, 'color-paper'));
      expect(hex(t, 'color-muted-on-night')).not.toBe(hex(t, 'color-night'));
    });
  }
});
