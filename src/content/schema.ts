import { z } from 'zod';
import { CATEGORIES, LANGS } from './types.ts';

const text = z.string().trim().min(1);
const stripVs = (s: string) => s.replace(/️/g, '');

export const nameStatusSchema = z.enum(['draft', 'reviewed', 'approved']);

export const cardNameSchema = z.strictObject({
  text,
  ipa: text.optional(),
  status: nameStatusSchema,
  audio: text.optional(),
  source: text.optional(),
  kind: z.enum(['attested', 'loanword', 'descriptive', 'neologism']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  gloss: text.optional(),
  note: text.optional(),
  reviewQuestion: text.optional(),
  sensitivity: text.optional(),
  avoidWith: z.array(z.string()).optional(),
  headword: text.optional(),
});

const namesSchema = z
  .strictObject({
    es: cardNameSchema.optional(),
    en: cardNameSchema.optional(),
    nah: cardNameSchema.optional(),
    yua: cardNameSchema.optional(),
    quz: cardNameSchema.optional(),
  })
  .superRefine((names, ctx) => {
    for (const lang of LANGS) {
      const n = names[lang];
      if (lang === 'es' || lang === 'en') {
        if (!n || n.status !== 'approved') {
          ctx.addIssue({
            code: 'custom',
            path: [lang],
            message: `${lang} name must exist and be approved`,
          });
        }
        continue;
      }
      if (!n) {
        ctx.addIssue({ code: 'custom', path: [lang], message: `${lang} name missing` });
        continue;
      }
      if (n.confidence !== 'high' && !n.reviewQuestion) {
        ctx.addIssue({
          code: 'custom',
          path: [lang, 'reviewQuestion'],
          message: 'non-high confidence needs reviewQuestion',
        });
      }
      if (!n.source)
        ctx.addIssue({ code: 'custom', path: [lang, 'source'], message: 'source required' });
      if (n.status !== 'draft' && !(n.audio && n.source)) {
        ctx.addIssue({
          code: 'custom',
          path: [lang],
          message: `${n.status} name requires audio and source`,
        });
      }
    }
  });

const twoLines = text.refine(
  (s) => {
    const l = s.split('\n');
    return l.length === 2 && l.every((x) => x.trim().length > 0);
  },
  { message: 'verso must be exactly 2 non-empty lines' },
);
const bilingual = <T extends z.ZodType>(t: T) => z.strictObject({ es: t, en: t });

/** One pictographic character, optional VS16; no skin tones, no ZWJ sequences. */
const art = z.string().regex(/^\p{Extended_Pictographic}️?$/u, 'art must be a single emoji');

export const cardSchema = z.strictObject({
  n: z.number().int().min(1).max(54),
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  category: z.enum(CATEGORIES),
  art,
  emoji: art.optional(),
  tags: z
    .array(z.string().regex(/^[a-z][a-z0-9 -]*$/))
    .min(3)
    .max(6)
    .refine((t) => new Set(t).size === t.length, { message: 'tags must be unique' }),
  names: namesSchema,
  verso: bilingual(twoLines),
  riddle: bilingual(text),
  confusableWith: z.array(z.string()).optional(),
});

export const cardsSchema = z
  .array(cardSchema)
  .length(54)
  .superRefine((cards, ctx) => {
    const seen = { id: new Set<string>(), n: new Set<number>(), art: new Set<string>() };
    cards.forEach((c, i) => {
      if (seen.id.has(c.id))
        ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate id ${c.id}` });
      if (seen.n.has(c.n))
        ctx.addIssue({ code: 'custom', path: [i, 'n'], message: `duplicate n ${c.n}` });
      const a = stripVs(c.art);
      if (seen.art.has(a))
        ctx.addIssue({ code: 'custom', path: [i, 'art'], message: `duplicate art ${c.art}` });
      seen.id.add(c.id);
      seen.n.add(c.n);
      seen.art.add(a);
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    cards.forEach((c, i) => {
      for (const lang of LANGS) {
        for (const o of c.names[lang]?.avoidWith ?? []) {
          const other = byId.get(o);
          if (!other || o === c.id) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'names', lang, 'avoidWith'],
              message: `unknown or self id ${o}`,
            });
          } else if (!other.names[lang]?.avoidWith?.includes(c.id)) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'names', lang, 'avoidWith'],
              message: `${c.id} <-> ${o} avoidWith is not symmetric in ${lang}`,
            });
          }
        }
      }
      for (const o of c.confusableWith ?? []) {
        const other = byId.get(o);
        if (!other || o === c.id) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'confusableWith'],
            message: `unknown or self id ${o}`,
          });
        } else if (!other.confusableWith?.includes(c.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'confusableWith'],
            message: `${c.id} <-> ${o} is not symmetric`,
          });
        }
      }
    });
  });

export type Card = z.infer<typeof cardSchema>;

export const creditsSchema = z.strictObject({
  art: z.strictObject({ kind: z.string(), note: bilingual(text) }),
  names: z.strictObject({ note: bilingual(text) }),
  software: z.array(z.strictObject({ name: z.string(), license: z.string() })),
  contributors: z.array(z.strictObject({ name: z.string(), role: z.string() })),
});
