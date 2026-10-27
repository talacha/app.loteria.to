import { z } from 'zod';
import { MAX_TABLA_INDEX, PATTERN_IDS } from '@engine';
import type { Msg as EngineMsg, PatternId, RoundFields } from '@engine';

const lang = z.enum(['es', 'en', 'nah', 'yua', 'quz']);
const pattern = z.enum(PATTERN_IDS as [PatternId, ...PatternId[]]);
const cardId = z.string().min(1).max(64);
const seat = z.string().min(1).max(64);
// Rejects control, format and bidi-override characters (except ZWJ).
// ZWJ is allowed (emoji sequences); variation selectors are not in \p{C}.
const DISALLOWED = /[\p{C}‪-‮⁦-⁩]/gu;
const SAFE_TEXT = /^(?:[^\p{C}‪-‮⁦-⁩]|‍)*$/u;

/** Strip disallowed characters (keeping ZWJ) and trim. */
export function sanitizeName(s: string): string {
  return s.replace(DISALLOWED, (c) => (c === '‍' ? c : '')).trim();
}

export function isValidName(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 40 && SAFE_TEXT.test(t);
}

const unique = (a: string[]) => new Set(a).size === a.length;
const roundNo = z.number().int().min(0).max(10000);
const cardList = z.array(cardId).max(54).refine(unique, 'duplicate entries');

const name = z.string().trim().min(1).max(40).regex(SAFE_TEXT);
const glyph = z.string().min(1).max(16).regex(SAFE_TEXT);
const pronouns = z.string().max(30).regex(SAFE_TEXT).optional();
const lobbyPlayer = z.object({ seat, name, glyph, pronouns });

const roundFields = {
  seed: z.string().min(1).max(128),
  roundNo,
  mode: z.enum(['normal', 'escucha']),
  pattern,
  callLang: z.union([lang, z.literal('rotating')]),
  speedSec: z.number().finite().min(3).max(60),
  /** Transport extension (TOFU): the host's signing key. Never carries deckSecret. */
  hostKey: z.string().min(1).max(128).optional(),
};
const tablaIndex = z.number().int().min(0).max(MAX_TABLA_INDEX);

export const msgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('round'), ...roundFields }),
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
    t: z.literal('welcome'),
    seat,
    tablaIndex,
    round: z.object(roundFields).nullable(),
    called: cardList,
  }),
  z.object({
    t: z.literal('hello'),
    seat,
    name,
    glyph,
    pronouns,
    labelLang: lang,
  }),
  z.object({ t: z.literal('claim'), seat, tablaIndex, marks: cardList }),
  // App-level extension: pre-game lobby broadcast.
  z.object({
    t: z.literal('lobby'),
    status: z.enum(['waiting', 'started']),
    players: z
      .array(lobbyPlayer)
      .max(60)
      .refine((a) => new Set(a.map((p) => p.seat)).size === a.length, 'duplicate seats'),
    roundNo: roundNo.optional(),
    hostKey: z.string().min(1).max(128).optional(),
  }),
]);

export type { RoundFields };

/** Engine wire types plus the app-level `lobby` extension. Schemas also accept an optional
 * transport-level `hostKey` on round/welcome.round/lobby (TOFU). */
export type Msg =
  | EngineMsg
  | {
      t: 'lobby';
      status: 'waiting' | 'started';
      players: { seat: string; name: string; glyph: string; pronouns?: string }[];
      roundNo?: number;
      hostKey?: string;
    };

// Type-level check: schema output is assignable to Msg and every Msg is accepted as schema input.
type Assert<T extends true> = T;
export type _SchemaMatchesOut = Assert<z.output<typeof msgSchema> extends Msg ? true : false>;
export type _SchemaMatchesIn = Assert<Msg extends z.input<typeof msgSchema> ? true : false>;

/** Transport-level host key carried by round and lobby messages. */
export function msgHostKey(m: Msg): string | undefined {
  return (m.t === 'round' || m.t === 'lobby') && 'hostKey' in m ? m.hostKey : undefined;
}

export type HostOnlyType = 'round' | 'call' | 'claimResult' | 'end' | 'welcome' | 'lobby';
export const HOST_ONLY: ReadonlySet<Msg['t']> = new Set<HostOnlyType>([
  'round',
  'call',
  'claimResult',
  'end',
  'welcome',
  'lobby',
]);

export function parseMsg(input: unknown): Msg | null {
  const r = msgSchema.safeParse(input);
  return r.success ? (r.data as Msg) : null;
}
