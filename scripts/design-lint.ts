import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Design lint (docs/DESIGN.md §2): component CSS may only use tokens.
 * Flags raw colours, font-family literals, raw border-radius lengths, box-shadow that is not a
 * token, and named colours. tokens.css (and design/**) are the only places for raw values.
 */
export interface Finding {
  line: number;
  rule: string;
  message: string;
}

export const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
    'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
    'darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid ' +
    'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
    'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ' +
    'ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
    'lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
    'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
    'orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru ' +
    'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
    'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);

const COLOR_PROPS =
  /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|accent-color|caret-color|text-decoration-color|column-rule-color|text-shadow|box-shadow)$/;
const RAW_COLOR = /#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/;
const LENGTH = /(?<![\w.-])-?\d*\.?\d+(?:px|rem|em|vw|vh|%)(?![\w-])/;

/** Remove var(...) and url(...) so their contents are never judged. */
function stripVars(v: string): string {
  let out = v;
  for (let i = 0; i < 5; i++) out = out.replace(/(?:var|url)\([^()]*\)/g, ' ');
  return out;
}

export function checkDeclaration(prop: string, value: string): { rule: string; message: string }[] {
  const out: { rule: string; message: string }[] = [];
  const p = prop.trim().toLowerCase();
  const bare = stripVars(value);
  if (p.startsWith('--')) {
    if (RAW_COLOR.test(bare))
      out.push({ rule: 'raw-color', message: `raw colour in ${p}: ${value.trim()}` });
    return out; // custom properties are only checked for raw colours
  }
  if (COLOR_PROPS.test(p)) {
    if (RAW_COLOR.test(bare))
      out.push({ rule: 'raw-color', message: `raw colour in ${p}: ${value.trim()}` });
    else {
      for (const w of bare.toLowerCase().match(/[a-z]+/g) ?? []) {
        if (NAMED_COLORS.has(w))
          out.push({ rule: 'named-color', message: `named colour "${w}" in ${p}` });
      }
    }
  } else if (RAW_COLOR.test(bare)) {
    out.push({ rule: 'raw-color', message: `raw colour in ${p}: ${value.trim()}` });
  }
  if (p === 'font-family' && !/^\s*(var\([^)]*\)|inherit|initial|unset)\s*$/.test(value)) {
    out.push({
      rule: 'font-family',
      message: `font-family literal: ${value.trim()} (use var(--font-*))`,
    });
  }
  if (p === 'font' && !/^\s*(inherit|initial|unset)\s*$/.test(value) && !/var\(/.test(value)) {
    out.push({ rule: 'font-family', message: `font shorthand literal: ${value.trim()}` });
  }
  if (p.endsWith('border-radius') || /^border-(top|bottom)-(left|right)-radius$/.test(p)) {
    if (LENGTH.test(bare) && !/^\s*(0|50%)\s*$/.test(bare)) {
      out.push({ rule: 'radius', message: `raw radius ${value.trim()} (use var(--radius-*))` });
    }
  }
  if (p === 'box-shadow') {
    const parts = value.split(/,(?![^(]*\))/).map((s) => s.trim());
    const ok = (s: string) =>
      s === 'none' ||
      /^var\(--shadow-[\w-]+\)$/.test(s) ||
      /^(?:inset\s+)?-?\d+(?:px)?\s+-?\d+(?:px)?\s+0\s+(?:-?\d+px\s+)?var\(--[\w-]+\)$/.test(s); // zero-blur offset/ring in a token colour
    if (!parts.every(ok))
      out.push({ rule: 'shadow', message: `box-shadow not a token: ${value.trim()}` });
  }
  return out;
}

/** Strip comments, keeping line numbers. */
function blank(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const GROUND_ONLY_TEXT =
  /^\s*var\(--(?:paper|color-paper|muted-on-night|maiz|color-maiz)\)\s*(?:!important)?\s*$/;
const COLOURED_FILL =
  /var\(--(?:color-)?(?:maiz|rosa|cielo|jade|maya|quechua|ink|paper|chile|bean|shadow)(?:-[a-z]+)?\)|var\(--lang-[\w-]+\)/;

/**
 * theme-text-on-ground: these text colours are dark-theme-only. Unless the same rule block paints a
 * coloured fill behind the text, the text sits on the page ground and must use var(--color-text),
 * var(--color-muted-on-night) or var(--color-accent-text), which flip with the theme.
 */
function themeTextOnGround(text: string, index: number, prop: string, value: string): boolean {
  if (prop.trim().toLowerCase() !== 'color' || !GROUND_ONLY_TEXT.test(value)) return false;
  const open = text.lastIndexOf('{', index);
  const close = text.indexOf('}', index);
  const block = text.slice(open + 1, close === -1 ? undefined : close);
  for (const m of block.matchAll(/(?:^|[;\s])background(?:-color)?\s*:\s*([^;}]+)/g)) {
    if (COLOURED_FILL.test(m[1] as string)) return false;
  }
  return true;
}

export function lintCss(css: string): Finding[] {
  const text = blank(css);
  const findings: Finding[] = [];
  const re = /([-\w]+)\s*:\s*([^;{}]+)(?=;|})/g;
  for (const m of text.matchAll(re)) {
    const before = text.slice(0, m.index);
    const line = before.split('\n').length;
    // Skip selectors such as `a:hover` (no preceding `{` or `;` on the way back).
    const lastBreak = Math.max(
      before.lastIndexOf('{'),
      before.lastIndexOf(';'),
      before.lastIndexOf('}'),
    );
    const gap = before.slice(lastBreak + 1);
    if (gap.trim() !== '') continue;
    for (const f of checkDeclaration(m[1] as string, m[2] as string)) findings.push({ line, ...f });
    if (themeTextOnGround(text, m.index, m[1] as string, m[2] as string)) {
      findings.push({
        line,
        rule: 'theme-text-on-ground',
        message: `color: ${(m[2] as string).trim()} only works on dark; use var(--color-text), var(--color-muted-on-night) or var(--color-accent-text) (or set a coloured background in the same rule)`,
      });
    }
  }
  return findings;
}

const STYLE_PROP: Record<string, string> = {
  fontFamily: 'font-family',
  borderRadius: 'border-radius',
  boxShadow: 'box-shadow',
  background: 'background',
  backgroundColor: 'background-color',
  color: 'color',
  borderColor: 'border-color',
  border: 'border',
  fill: 'fill',
  stroke: 'stroke',
  outline: 'outline',
};

/** Best effort: inspect `style={{ ... }}` literals in TSX. */
export function lintTsx(src: string): Finding[] {
  const findings: Finding[] = [];
  for (const block of src.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
    const body = block[1] as string;
    const startLine = src.slice(0, block.index).split('\n').length;
    for (const m of body.matchAll(/(\w+)\s*:\s*(`[^`]*`|'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)/g)) {
      const prop = STYLE_PROP[m[1] as string];
      if (!prop) continue;
      let value = (m[2] as string).replace(/^['"`]|['"`]$/g, '');
      if (prop === 'border-radius' && /^\d+$/.test(value)) value = `${value}px`;
      const line = startLine + body.slice(0, m.index).split('\n').length - 1;
      for (const f of checkDeclaration(prop, value)) findings.push({ line, ...f });
    }
  }
  return findings;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function scanTargets(root: string): string[] {
  return walk(join(root, 'src/app')).filter(
    (f) =>
      (/\.css$/.test(f) || (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))) &&
      !f.endsWith('src/app/theme/tokens.css'),
  );
}

export function lintFile(file: string): Finding[] {
  const src = readFileSync(file, 'utf8');
  return file.endsWith('.css') ? lintCss(src) : lintTsx(src);
}

function main(): number {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const perDir = new Map<string, number>();
  let total = 0;
  for (const file of scanTargets(root).sort()) {
    const rel = relative(root, file);
    for (const f of lintFile(file)) {
      total++;
      const dir = rel.split('/').slice(0, 3).join('/');
      perDir.set(dir, (perDir.get(dir) ?? 0) + 1);
      console.error(`${rel}:${f.line}:${f.rule} ${f.message}`);
    }
  }
  if (total > 0) {
    console.error(`\ndesign-lint: ${total} problem${total === 1 ? '' : 's'}`);
    for (const [d, n] of [...perDir].sort()) console.error(`  ${d}: ${n}`);
    return 1;
  }
  console.log('design-lint: ok');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
