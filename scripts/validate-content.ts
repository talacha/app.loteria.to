import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import cardsJson from '../src/content/cards.json' with { type: 'json' };
import creditsJson from '../src/content/credits.json' with { type: 'json' };
import es from '../src/content/i18n/es.json' with { type: 'json' };
import en from '../src/content/i18n/en.json' with { type: 'json' };
import { cardsSchema, creditsSchema } from '../src/content/schema.ts';
import { CATEGORIES, INDIGENOUS_LANGS, LANGS } from '../src/content/types.ts';

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
    if (ns.some((n, i) => n !== i + 1)) errors.push('card numbers must be exactly 1..144');
    for (const cat of CATEGORIES) {
      const count = cards.filter((c) => c.category === cat).length;
      if (count !== 24) errors.push(`category ${cat} has ${count} cards (need 24)`);
    }
    for (const c of cards) {
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
