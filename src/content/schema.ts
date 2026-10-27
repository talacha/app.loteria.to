import { z } from 'zod';
import { CATEGORIES, LANGS } from './types.ts';

const text = z.string().trim().min(1);
export const nameStatusSchema = z.enum(['draft', 'reviewed', 'approved']);

/** Integrity and provenance of the delivered clip. `file` equals the name's `audio` path. */
export const clipSchema = z.strictObject({
  file: z.string().regex(/^\/audio\/[a-z]{2,3}\/[a-z0-9_-]+\.[0-9a-f]{8}\.m4a$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  engine: z.enum(['kokoro', 'mms', 'recording']),
  model: text.optional(),
  revision: text.optional(),
  voice: text.optional(),
  durationMs: z.number().int().positive(),
});
export const audioReasonSchema = z.enum(['needs-recording', 'missing-word', 'pending-generation']);

export const cardNameSchema = z.strictObject({
  text,
  ipa: text.optional(),
  status: nameStatusSchema,
  audio: text.nullable().optional(),
  clip: clipSchema.optional(),
  audioReason: audioReasonSchema.optional(),
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

/**
 * cjp (Cabecar) and bzd (Bribri): imported from drafts, not playable yet. A missing word is explicit
 * (`text: null`, `status: 'missing'`); a present word without a clip says why (`audioReason`).
 */
export const extNameSchema = cardNameSchema
  .extend({ text: text.nullable(), status: z.enum(['draft', 'reviewed', 'approved', 'missing']) })
  .superRefine((n, ctx) => {
    if (n.text === null) {
      if (n.status !== 'missing' || n.audio !== null || n.audioReason !== 'missing-word')
        ctx.addIssue({
          code: 'custom',
          message: "missing word needs status 'missing', audio null, audioReason 'missing-word'",
        });
    } else if (n.status === 'missing') {
      ctx.addIssue({ code: 'custom', message: "status 'missing' needs text null" });
    } else if (!n.audio && n.audioReason !== 'needs-recording') {
      ctx.addIssue({ code: 'custom', message: "no audio needs audioReason 'needs-recording'" });
    } else if (n.audio && !n.clip) {
      ctx.addIssue({ code: 'custom', message: 'audio needs clip metadata' });
    }
  });

const namesSchema = z
  .strictObject({
    es: cardNameSchema.optional(),
    en: cardNameSchema.optional(),
    nah: extNameSchema.optional(),
    yua: extNameSchema.optional(),
    quz: extNameSchema.optional(),
    cjp: extNameSchema.optional(),
    bzd: extNameSchema.optional(),
  })
  .superRefine((names, ctx) => {
    for (const lang of LANGS) {
      const clip = names[lang]?.clip;
      if (clip && clip.file !== names[lang]?.audio)
        ctx.addIssue({
          code: 'custom',
          path: [lang, 'clip'],
          message: 'clip.file must equal audio',
        });
      const n = names[lang];
      if (lang === 'es' || lang === 'en') {
        if (!n || n.status !== 'approved') {
          ctx.addIssue({
            code: 'custom',
            path: [lang],
            message: `${lang} name must exist and be approved`,
          });
        }
        if (n && !n.audio && n.audioReason !== 'pending-generation')
          ctx.addIssue({ code: 'custom', path: [lang, 'audio'], message: 'audio required' });
        continue;
      }
      if (!n) continue;
      if (n.text === null) continue;
      if (n.confidence !== 'high' && !n.reviewQuestion) {
        ctx.addIssue({
          code: 'custom',
          path: [lang, 'reviewQuestion'],
          message: 'non-high confidence needs reviewQuestion',
        });
      }
      if (!n.source)
        ctx.addIssue({ code: 'custom', path: [lang, 'source'], message: 'source required' });
      if (!n.audio && n.audioReason !== 'needs-recording')
        ctx.addIssue({ code: 'custom', path: [lang, 'audio'], message: 'audio required' });
      if (n.audio && !n.clip)
        ctx.addIssue({ code: 'custom', path: [lang, 'clip'], message: 'clip metadata required' });
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
  n: z.number().int().min(1).max(144),
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  category: z.enum(CATEGORIES),
  art,
  emoji: art.optional(),
  tags: z
    .array(z.string().regex(/^[a-z][a-z0-9 -]*$/))
    .min(3)
    .max(6)
    .refine((t) => new Set(t).size === t.length, { message: 'tags must be unique' })
    .optional(),
  names: namesSchema,
  verso: bilingual(twoLines).optional(),
  riddle: bilingual(text).optional(),
  confusableWith: z.array(z.string()).optional(),
});

export const cardsSchema = z
  .array(cardSchema)
  .length(144)
  .superRefine((cards, ctx) => {
    const seen = { id: new Set<string>(), n: new Set<number>() };
    cards.forEach((c, i) => {
      if (seen.id.has(c.id))
        ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate id ${c.id}` });
      if (seen.n.has(c.n))
        ctx.addIssue({ code: 'custom', path: [i, 'n'], message: `duplicate n ${c.n}` });
      seen.id.add(c.id);
      seen.n.add(c.n);
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
