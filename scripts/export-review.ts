import { mkdirSync, writeFileSync } from 'node:fs';
import cardsJson from '../src/content/cards.json' with { type: 'json' };
import { cardsSchema } from '../src/content/schema.ts';
import { INDIGENOUS_LANGS } from '../src/content/types.ts';

const HEADER = [
  'card_n',
  'card_id',
  'es',
  'en',
  'draft_text',
  'gloss',
  'ipa',
  'kind',
  'confidence',
  'sensitivity',
  'review_question',
  'note',
  'approved',
  'corrected_text',
  'reviewer_notes',
];

const q = (v: string | number | null | undefined) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const cards = cardsSchema.parse(cardsJson);
mkdirSync('docs/review', { recursive: true });
for (const lang of INDIGENOUS_LANGS) {
  const rows = cards.map((c) => {
    const n = c.names[lang];
    return [
      c.n,
      c.id,
      c.names.es?.text,
      c.names.en?.text,
      n?.text,
      n?.gloss,
      n?.ipa,
      n?.kind,
      n?.confidence,
      n?.sensitivity,
      n?.reviewQuestion,
      n?.note,
      '',
      '',
      '',
    ]
      .map(q)
      .join(',');
  });
  writeFileSync(`docs/review/${lang}.csv`, [HEADER.join(','), ...rows].join('\n') + '\n');
  console.log(`wrote docs/review/${lang}.csv (${rows.length} rows)`);
}
