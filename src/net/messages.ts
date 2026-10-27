import { z } from 'zod';
import { MAX_TABLA_INDEX, ROOM_MAX_PLAYERS } from '@engine';
import type { CardId, Lang } from '@engine';

const lang = z.enum(['es', 'en', 'nah', 'yua', 'quz']);
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

export const msgSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('round'),
    seed: z.string().min(1).max(128),
    roundNo,
    speedSec: z.number().finite().min(3).max(60),
    /** Cartón is gridSize x gridSize, 3..8. Absent (older hosts) means 4. */
    gridSize: z.number().int().min(3).max(8).optional(),
    hostKey: z.string().min(1).max(128).optional(),
  }),
  z.object({
    t: z.literal('assign'),
    seat,
    tablaIndex: z.number().int().min(0).max(MAX_TABLA_INDEX),
    roundNo,
  }),
  z
    .object({
      t: z.literal('call'),
      i: z.number().int().min(0).max(1000),
      cardId,
      choices: z.tuple([cardId, cardId, cardId]),
      at: z.number().int().min(0),
    })
    .refine((c) => new Set(c.choices).size === 3 && c.choices.includes(c.cardId), 'bad choices'),
  z.object({ t: z.literal('callClosed'), roundNo, i: z.number().int().min(0).max(1000) }),
  z.object({
    t: z.literal('end'),
    roundNo,
    reason: z.literal('full-card'),
    winners: z.array(seat).max(54).refine(unique, 'duplicate entries'),
  }),
  z.object({
    t: z.literal('pick'),
    seat,
    roundNo,
    i: z.number().int().min(0).max(1000),
    cardId,
  }),
  z.object({
    t: z.literal('pickResult'),
    roundNo,
    i: z.number().int().min(0).max(1000),
    seat,
    correct: z.boolean(),
    points: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    first: z.boolean(),
  }),
  z.object({
    t: z.literal('scores'),
    roundNo,
    points: z
      .record(seat, z.number().int().min(0).max(200))
      .refine((r) => Object.keys(r).length <= 60, 'too many entries'),
    /** Squares crossed out (0..64, at most gridSize²) per seat, for the leaderboard. Hosts always send it. */
    crossed: z
      .record(seat, z.number().int().min(0).max(64))
      .refine((r) => Object.keys(r).length <= 60, 'too many entries')
      .optional(),
  }),
  z.object({
    t: z.literal('lobby'),
    status: z.enum(['waiting', 'started', 'full']),
    players: z
      .array(lobbyPlayer)
      .max(ROOM_MAX_PLAYERS)
      .refine((a) => new Set(a.map((p) => p.seat)).size === a.length, 'duplicate seats'),
    roundNo: roundNo.optional(),
    hostKey: z.string().min(1).max(128).optional(),
    /** Room defaults for what joiners start with; each player can change both. */
    defaults: z.object({ spokenLang: lang, uiLang: z.enum(['es', 'en']) }).optional(),
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
    roundNo,
    tablaIndex: z.number().int().min(0).max(MAX_TABLA_INDEX),
    marks: cardList,
  }),
]);

export type Msg =
  | {
      t: 'round';
      seed: string;
      roundNo: number;
      speedSec: number;
      gridSize?: number;
      hostKey?: string;
    }
  | {
      t: 'lobby';
      status: 'waiting' | 'started' | 'full';
      players: { seat: string; name: string; glyph: string; pronouns?: string }[];
      roundNo?: number;
      hostKey?: string;
      defaults?: { spokenLang: Lang; uiLang: 'es' | 'en' };
    }
  | { t: 'assign'; seat: string; tablaIndex: number; roundNo: number }
  | {
      t: 'call';
      i: number;
      cardId: CardId;
      choices: [CardId, CardId, CardId];
      at: number;
    }
  | { t: 'pick'; seat: string; roundNo: number; i: number; cardId: CardId }
  | {
      t: 'pickResult';
      roundNo: number;
      i: number;
      seat: string;
      correct: boolean;
      points: 0 | 1 | 2;
      first: boolean;
    }
  | { t: 'callClosed'; roundNo: number; i: number }
  | {
      t: 'scores';
      roundNo: number;
      points: Record<string, number>;
      crossed?: Record<string, number>;
    }
  | { t: 'end'; roundNo: number; winners: string[]; reason: 'full-card' }
  | { t: 'hello'; seat: string; name: string; glyph: string; pronouns?: string; labelLang: Lang }
  | { t: 'claim'; seat: string; roundNo: number; tablaIndex: number; marks: CardId[] };

export type HostOnlyType =
  'round' | 'call' | 'callClosed' | 'end' | 'assign' | 'lobby' | 'pickResult' | 'scores';
export const HOST_ONLY: ReadonlySet<Msg['t']> = new Set<HostOnlyType>([
  'round',
  'call',
  'callClosed',
  'end',
  'assign',
  'lobby',
  'pickResult',
  'scores',
]);

export function parseMsg(input: unknown): Msg | null {
  const r = msgSchema.safeParse(input);
  return r.success ? (r.data as Msg) : null;
}
