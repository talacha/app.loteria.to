import { z } from 'zod';
import { MAX_TABLA_INDEX } from '@engine';
import type { CardId, Lang, PatternId } from '@engine';

const lang = z.enum(['es', 'en', 'nah', 'yua', 'quz']);
const pattern = z.enum(['line', 'corners', 'center', 'full']);
const cardId = z.string().min(1).max(64);
const seat = z.string().min(1).max(64);
// Rejects control, format and bidi-override characters.
const SAFE_TEXT = /^[^\p{C}‪-‮⁦-⁩]*$/u;
const unique = (a: string[]) => new Set(a).size === a.length;
const cardList = z.array(cardId).max(54).refine(unique, 'duplicate entries');

export const msgSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('round'),
    seed: z.string().min(1).max(128),
    roundNo: z.number().int().min(0).max(10000),
    mode: z.enum(['normal', 'escucha']),
    pattern,
    callLang: z.union([lang, z.literal('rotating')]),
    speedSec: z.number().finite().min(3).max(60),
    hostKey: z.string().min(1).max(128).optional(),
  }),
  z.object({
    t: z.literal('call'),
    i: z.number().int().min(0).max(1000),
    cardId,
    lang,
    at: z.number().int().min(0),
  }),
  z.object({
    t: z.literal('claimResult'),
    seat,
    valid: z.boolean(),
    missing: cardList.optional(),
  }),
  z.object({
    t: z.literal('end'),
    winners: z.array(seat).max(54).refine(unique, 'duplicate entries'),
  }),
  z.object({
    t: z.literal('hello'),
    seat,
    name: z.string().trim().min(1).max(40).regex(SAFE_TEXT),
    glyph: z.string().min(1).max(16).regex(SAFE_TEXT),
    pronouns: z.string().max(30).regex(SAFE_TEXT).optional(),
    labelLang: lang,
  }),
  z.object({
    t: z.literal('claim'),
    seat,
    tablaIndex: z.number().int().min(0).max(MAX_TABLA_INDEX),
    marks: cardList,
  }),
]);

export type Msg =
  | {
      t: 'round';
      seed: string;
      roundNo: number;
      mode: 'normal' | 'escucha';
      pattern: PatternId;
      callLang: Lang | 'rotating';
      speedSec: number;
      hostKey?: string;
    }
  | { t: 'call'; i: number; cardId: CardId; lang: Lang; at: number }
  | { t: 'claimResult'; seat: string; valid: boolean; missing?: CardId[] }
  | { t: 'end'; winners: string[] }
  | { t: 'hello'; seat: string; name: string; glyph: string; pronouns?: string; labelLang: Lang }
  | { t: 'claim'; seat: string; tablaIndex: number; marks: CardId[] };

export type HostOnlyType = 'round' | 'call' | 'claimResult' | 'end';
export const HOST_ONLY: ReadonlySet<Msg['t']> = new Set<HostOnlyType>([
  'round',
  'call',
  'claimResult',
  'end',
]);

export function parseMsg(input: unknown): Msg | null {
  const r = msgSchema.safeParse(input);
  return r.success ? (r.data as Msg) : null;
}
