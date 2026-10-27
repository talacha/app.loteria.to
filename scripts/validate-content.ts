import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import cardsJson from '../src/content/cards.json' with { type: 'json' };
import creditsJson from '../src/content/credits.json' with { type: 'json' };
import es from '../src/content/i18n/es.json' with { type: 'json' };
import en from '../src/content/i18n/en.json' with { type: 'json' };
import { cardsSchema, creditsSchema } from '../src/content/schema.ts';
import { CATEGORIES, INDIGENOUS_LANGS, LANGS } from '../src/content/types.ts';

/**
 * Allowlist of art codepoints (VS16 stripped). Every entry is Emoji version <= 12.0
 * (2019), so it renders on all supported system fonts. Add an entry only after checking
 * its Emoji version; frijol uses a sprout because the bean emoji is E14.
 */
const EMOJI_ALLOWLIST = new Set<number>([
  0x1f406,
  0x1f426,
  0x1f999,
  0x1f985,
  0x1f98b,
  0x1f983,
  0x1f422,
  0x1f438,
  0x1f40d, // animals
  0x1f33d,
  0x1f335,
  0x1f331,
  0x1f34d,
  0x1f336,
  0x1f954,
  0x1f951,
  0x1f345,
  0x1f33b, // plants_food
  0x2600,
  0x1f319,
  0x2b50,
  0x1f327,
  0x26a1,
  0x1f308,
  0x2601,
  0x1f4a8,
  0x2604, // sky
  0x1f3d4,
  0x1f30b,
  0x1f4a7,
  0x1f30a,
  0x1f3dc,
  0x1f334,
  0x1f48e,
  0x1f3dd,
  0x1f573, // land
  0x1f3fa,
  0x1f9fa,
  0x1f941,
  0x1f9f5,
  0x1f6f6,
  0x1f309,
  0x1f9f1,
  0x1f56f,
  0x1f528, // handmade
  0x1f3e0,
  0x1f33e,
  0x1f3ea,
  0x26f2,
  0x2693,
  0x1f3d8,
  0x1f3eb,
  0x1f52d,
  0x1f4da, // places
]);

export function flattenKeys(o: unknown, prefix = ''): string[] {
  if (o === null || typeof o !== 'object') return [prefix];
  return Object.entries(o).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k));
}

export function validateContent(): string[] {
  const errors: string[] = [];
  const fmt = (file: string, issues: { path: PropertyKey[]; message: string }[]) =>
    issues.map((i) => `${file}: ${i.path.map(String).join('.') || '(root)'}: ${i.message}`);

  const parsed = cardsSchema.safeParse(cardsJson);
  if (!parsed.success) errors.push(...fmt('cards.json', parsed.error.issues));
  const cr = creditsSchema.safeParse(creditsJson);
  if (!cr.success) errors.push(...fmt('credits.json', cr.error.issues));

  if (parsed.success) {
    const cards = parsed.data;
    const ns = cards.map((c) => c.n).sort((a, b) => a - b);
    if (ns.some((n, i) => n !== i + 1)) errors.push('card numbers must be exactly 1..54');
    for (const cat of CATEGORIES) {
      const count = cards.filter((c) => c.category === cat).length;
      if (count < 7 || count > 11) errors.push(`category ${cat} has ${count} cards (need 7-11)`);
    }
    for (const c of cards) {
      const cp = c.art.codePointAt(0);
      if (cp === undefined || !EMOJI_ALLOWLIST.has(cp)) {
        errors.push(`${c.id}: art ${c.art} is not in the Emoji <= 12.0 allowlist`);
      }
      for (const lang of LANGS) {
        const nm = c.names[lang];
        if (!nm?.audio) continue;
        if (!existsSync(new URL(`../public${nm.audio}`, import.meta.url))) {
          errors.push(`${c.id}.${lang}: audio file ${nm.audio} does not exist`);
        }
      }
    }
  }

  const a = new Set(flattenKeys(es));
  const b = new Set(flattenKeys(en));
  for (const k of a) if (!b.has(k)) errors.push(`en.json missing key ${k}`);
  for (const k of b) if (!a.has(k)) errors.push(`es.json missing key ${k}`);
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validateContent();
  if (errors.length) {
    console.error(`Content validation failed:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  const parsed = cardsSchema.parse(cardsJson);
  const drafts = parsed.reduce(
    (n, c) => n + INDIGENOUS_LANGS.filter((l) => c.names[l]?.status === 'draft').length,
    0,
  );
  console.log(`Content OK: ${parsed.length} cards, ${drafts} draft Indigenous names.`);
}
