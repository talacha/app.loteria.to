import { z } from 'zod';
import { CATEGORIES } from './types.ts';

const text = z.string().trim().min(1);

export const cardNameSchema = z.strictObject({
  text,
  status: z.enum(['draft', 'reviewed', 'approved']),
  source: text.optional(),
  confidence: z.enum(['sourced', 'weak']).optional(),
  variant: z.literal('classical').optional(),
  audio: text.optional(),
  note: text.optional(),
});

export const cardSchema = z.strictObject({
  n: z.number().int().min(1).max(54),
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  category: z.enum(CATEGORIES),
  art: text,
  names: z.strictObject({
    es: cardNameSchema,
    en: cardNameSchema,
    nah: cardNameSchema,
    yua: cardNameSchema,
    quz: cardNameSchema,
  }),
  verso: z.strictObject({ es: text, en: text }).optional(),
});

export const deckFileSchema = z
  .strictObject({
    version: z.number(),
    variants: z.record(z.string(), z.string()),
    cards: z.array(cardSchema).length(54),
  })
  .superRefine((deck, ctx) => {
    const ids = new Set<string>();
    const ns = new Set<number>();
    deck.cards.forEach((c, i) => {
      if (ids.has(c.id))
        ctx.addIssue({ code: 'custom', path: ['cards', i, 'id'], message: `duplicate id ${c.id}` });
      if (ns.has(c.n))
        ctx.addIssue({ code: 'custom', path: ['cards', i, 'n'], message: `duplicate n ${c.n}` });
      ids.add(c.id);
      ns.add(c.n);
    });
  });

export type Card = z.infer<typeof cardSchema>;
export type CardName = z.infer<typeof cardNameSchema>;

const bilingual = z.strictObject({ es: text, en: text });
export const creditsSchema = z.strictObject({
  art: z.strictObject({ kind: z.string(), note: bilingual }),
  names: z.strictObject({ note: bilingual }),
  software: z.array(z.strictObject({ name: z.string(), license: z.string() })),
  contributors: z.array(z.strictObject({ name: z.string(), role: z.string() })),
});
