import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Copy lint: no gendered human roles in Spanish, no generic he/she in English,
 * and no prize/betting/money framing (the game is played with beans, not chips).
 */
/** 'es' / 'en' restrict a rule to that language; undefined rules apply everywhere. */
export type RuleLang = 'es' | 'en';
/** Language of the text being linted: a known language, 'other' (e.g. Indigenous names) or 'any'. */
export type TextLang = RuleLang | 'other' | 'any';

export interface Rule {
  id: string;
  message: string;
  words: string[];
  lang?: RuleLang;
}

export const RULES: Rule[] = [
  {
    id: 'gendered-role-es',
    lang: 'es',
    message:
      'gendered human role (use a neutral phrase: "quien juega", "persona", "las infancias")',
    words: [
      'jugador',
      'jugadora',
      'jugadores',
      'jugadoras',
      'jugadorxs',
      'ganador',
      'ganadora',
      'ganadores',
      'ganadoras',
      'niño',
      'niña',
      'niños',
      'niñas',
      'alumno',
      'alumna',
      'alumnos',
      'alumnas',
      'maestro',
      'maestra',
      'maestros',
      'maestras',
    ],
  },
  {
    id: 'gendered-cantor-es',
    lang: 'es',
    message: 'gendered "el/al/del cantor" as a person (say "quien canta")',
    words: ['el cantor', 'al cantor', 'del cantor'],
  },
  {
    id: 'gendered-pronoun-en',
    lang: 'en',
    message: 'gendered pronoun used generically (use "they" or rephrase)',
    words: ['he', 'she', 'him', 'his', 'hers', 'himself', 'herself', 'he/she', 's/he'],
  },
  {
    id: 'winning-es',
    lang: 'es',
    message: 'winning framing (say "completar la figura")',
    words: ['gana', 'ganar', 'ganó', 'ganen', 'ganan', 'ganaron', 'gane'],
  },
  {
    id: 'winning-en',
    lang: 'en',
    message: 'winning framing (say "complete the pattern")',
    words: ['win', 'wins', 'won', 'winner', 'winners', 'winning'],
  },
  {
    id: 'framing',
    message: 'prize / betting / money framing (play with beans, not chips)',
    words: [
      'premio',
      'premios',
      'prize',
      'prizes',
      'apuesta',
      'apuestas',
      'bet',
      'bets',
      'betting',
      'dinero',
      'money',
      'ficha',
      'fichas',
      'chip',
      'chips',
    ],
  },
];

/**
 * Words and phrases that must never be flagged. Fixed phrases cover innocent uses of otherwise
 * flagged words ("ficha técnica", "obra maestra"); "ganas de" needs no entry because only the
 * exact forms listed in RULES are matched.
 */
export const ALLOWLIST = [
  'cantora',
  'obra maestra',
  'obras maestras',
  'sin dinero',
  'no money',
  'ficha técnica',
  'fichas técnicas',
];

export interface Hit {
  rule: string;
  word: string;
  message: string;
}

const B = '(?<![\\p{L}\\p{N}_])';
const E = '(?![\\p{L}\\p{N}_])';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const compiled = RULES.map((r) => ({
  rule: r,
  re: new RegExp(
    `${B}(${[...r.words]
      .sort((a, b) => b.length - a.length)
      .map((w) => escape(w).replace(/ /g, '\\s+'))
      .join('|')})${E}`,
    'giu',
  ),
}));
const allowRe = new RegExp(
  `${B}(${ALLOWLIST.map((w) => escape(w).replace(/ /g, '\\s+')).join('|')})${E}`,
  'giu',
);

export function findHits(raw: string, lang: TextLang = 'any'): Hit[] {
  const clean = raw.normalize('NFC').replace(allowRe, (m) => ' '.repeat(m.length));
  const hits: Hit[] = [];
  for (const { rule, re } of compiled) {
    if (rule.lang && lang !== 'any' && rule.lang !== lang) continue;
    re.lastIndex = 0;
    for (const m of clean.matchAll(re)) {
      hits.push({ rule: rule.id, word: m[0], message: rule.message });
    }
  }
  return hits;
}

/** Pronoun pickers legitimately list pronouns as examples (e.g. "she, he, they"). */
export const PRONOUN_KEY = /(^|\.)pronouns?[A-Za-z]*$/i;

const SKIP_KEYS = new Set([
  'id',
  'art',
  'emoji',
  'tags',
  'category',
  'status',
  'source',
  'ipa',
  'audio',
  'confusableWith',
]);

/** Yield every user-visible string with its key path. Keys themselves are never linted. */
export function* walkStrings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walkStrings(value[i], `${path}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(k)) continue;
      yield* walkStrings(v, path ? `${path}.${k}` : k);
    }
  }
}

function listFiles(dir: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, match));
    else if (match(name)) out.push(p);
  }
  return out;
}

export function targetFiles(root: string): string[] {
  const content = join(root, 'src/content');
  const files = [
    ...listFiles(join(content, 'i18n'), (n) => n.endsWith('.json')),
    ...listFiles(join(root, 'src/app'), (n) => /^strings\.[\w-]+\.json$/.test(n)),
    ...listFiles(join(root, 'src/print'), (n) => /^strings\.[\w-]+\.json$/.test(n)),
    join(content, 'cards.json'),
  ];
  return files.sort();
}

/** Language from a file name (`es.json`, `strings.en.json`) or a key path (`verso.en`). */
export function langOf(file: string, path: string): TextLang {
  const f = /(?:^|[./\\])(es|en)\.json$/.exec(file) ?? /strings\.(es|en)\.json$/.exec(file);
  if (f) return f[1] as RuleLang;
  const p = /(?:^|[.\]])(es|en)(?:\.|$)/.exec(path);
  return p ? (p[1] as RuleLang) : 'other';
}

export function lintFile(file: string): { path: string; hit: Hit; text: string }[] {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const out: { path: string; hit: Hit; text: string }[] = [];
  for (const [path, text] of walkStrings(data, '')) {
    if (PRONOUN_KEY.test(path)) continue;
    for (const hit of findHits(text, langOf(file, path))) out.push({ path, hit, text });
  }
  return out;
}

function main(): number {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  let count = 0;
  for (const file of targetFiles(root)) {
    for (const { path, hit } of lintFile(file)) {
      count++;
      console.error(`${relative(root, file)}: ${path}: "${hit.word}" [${hit.rule}] ${hit.message}`);
    }
  }
  if (count > 0) {
    console.error(`copy-lint: ${count} problem${count === 1 ? '' : 's'} found`);
    return 1;
  }
  console.log('copy-lint: ok');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
