import {
  MAX_TABLA_INDEX,
  checkClaim,
  decodeTablaCode,
  deckOrder,
  isCardComplete,
  seedRef,
  tabla,
} from '@engine';
import type { CardId, Category, Lang, PatternId, PickState } from '@engine';

export type DeckCard = { id: CardId; category: Category };

export type CallLang = Lang | 'rotating';
export type Mode = 'normal' | 'escucha';
export type Phase = 'setup' | 'running' | 'paused' | 'ended';

export interface Settings {
  callLang: CallLang;
  speedSec: number;
  pattern: PatternId;
  mode: Mode;
  captions: boolean;
}

export const SPEED_PRESETS = { calm: 14, normal: 10, fast: 7 } as const;
export const MIN_SPEED = 6;
export const MAX_SPEED = 20;

export const DEFAULT_SETTINGS: Settings = {
  callLang: 'es',
  speedSec: SPEED_PRESETS.normal,
  pattern: 'line',
  mode: 'normal',
  captions: true,
};

export interface RoundState {
  phase: Phase;
  code: string;
  roomSeed: string;
  roundNo: number;
  settings: Settings;
  /** Languages usable for rotation (callableLangs at start). */
  langs: Lang[];
  /** All card ids in deck order for this round (empty during setup). */
  order: CardId[];
  /** How many cards have been called; the current card is order[calledCount - 1]. */
  calledCount: number;
  winners: string[];
  /** seat -> assigned tabla index for the current round. */
  assignments: Record<string, number>;
}

export function clampSpeed(n: number): number {
  if (!Number.isFinite(n)) return SPEED_PRESETS.normal;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(n)));
}

export function initialRound(code: string, roomSeed: string, langs: Lang[]): RoundState {
  return {
    phase: 'setup',
    code,
    roomSeed,
    roundNo: 1,
    settings: { ...DEFAULT_SETTINGS },
    langs: langs.length ? langs : ['es'],
    order: [],
    calledCount: 0,
    winners: [],
    assignments: {},
  };
}

export type RoundAction =
  | { type: 'configure'; patch: Partial<Settings> }
  | { type: 'setSeed'; roomSeed: string }
  | { type: 'setCode'; code: string }
  | { type: 'start'; ids: CardId[]; langs: Lang[] }
  | { type: 'next' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'togglePause' }
  | { type: 'assign'; seat: string; index: number }
  | { type: 'win'; seat: string }
  | { type: 'finish'; winners: string[] }
  | { type: 'end' }
  | { type: 'newRound' }
  | { type: 'restore'; saved: SavedRound; ids: CardId[] };

export interface SavedRound {
  code: string;
  roomSeed: string;
  roundNo: number;
  calledCount: number;
  settings: Settings;
  winners: string[];
  langs: Lang[];
  phase: Phase;
  assignments?: Record<string, number>;
  /** Roster at save time (seat -> player + assigned board). */
  roster?: SavedPlayer[];
  /** Points and crossed-out cards per seat (pick scoring). */
  pick?: PickState;
}

export interface SavedPlayer {
  seat: string;
  name: string;
  glyph: string;
  pronouns?: string;
  tablaIndex?: number;
}

export function roundReducer(s: RoundState, a: RoundAction): RoundState {
  switch (a.type) {
    case 'configure': {
      const settings = { ...s.settings, ...a.patch };
      settings.speedSec = clampSpeed(settings.speedSec);
      return { ...s, settings };
    }
    case 'setSeed':
      return s.phase === 'setup' ? { ...s, roomSeed: a.roomSeed } : s;
    case 'setCode':
      return s.phase === 'setup' ? { ...s, code: a.code } : s;
    case 'start': {
      if (s.phase !== 'setup' || a.ids.length === 0) return s;
      const langs = a.langs.length ? a.langs : s.langs;
      return {
        ...s,
        phase: 'running',
        langs,
        order: deckOrder(s.roomSeed, s.roundNo, a.ids),
        calledCount: 1,
        winners: [],
      };
    }
    case 'next': {
      if (s.phase !== 'running' && s.phase !== 'paused') return s;
      if (s.calledCount >= s.order.length) return { ...s, phase: 'ended' };
      return { ...s, calledCount: s.calledCount + 1 };
    }
    case 'pause':
      return s.phase === 'running' ? { ...s, phase: 'paused' } : s;
    case 'resume':
      return s.phase === 'paused' ? { ...s, phase: 'running' } : s;
    case 'togglePause':
      return roundReducer(s, { type: s.phase === 'running' ? 'pause' : 'resume' });
    case 'win': {
      if (s.phase !== 'running' && s.phase !== 'paused') return s;
      if (s.winners.includes(a.seat)) return s;
      return { ...s, winners: [...s.winners, a.seat], phase: 'paused' };
    }
    case 'finish': {
      if (s.phase !== 'running' && s.phase !== 'paused') return s;
      return { ...s, winners: [...new Set(a.winners)], phase: 'ended' };
    }
    case 'assign': {
      if (s.assignments[a.seat] === a.index) return s;
      return { ...s, assignments: { ...s.assignments, [a.seat]: a.index } };
    }
    case 'end':
      return s.phase === 'setup' ? s : { ...s, phase: 'ended' };
    case 'newRound':
      return {
        ...s,
        phase: 'setup',
        roundNo: s.roundNo + 1,
        order: [],
        calledCount: 0,
        winners: [],
        assignments: {},
      };
    case 'restore': {
      const v = a.saved;
      const order = v.phase === 'setup' ? [] : deckOrder(v.roomSeed, v.roundNo, a.ids);
      const calledCount = Math.max(0, Math.min(v.calledCount, order.length));
      const phase: Phase = v.phase === 'running' ? 'paused' : v.phase;
      return {
        phase,
        code: v.code,
        roomSeed: v.roomSeed,
        roundNo: v.roundNo,
        settings: { ...DEFAULT_SETTINGS, ...v.settings },
        langs: v.langs.length ? v.langs : ['es'],
        order,
        calledCount,
        winners: v.winners,
        assignments: { ...v.assignments },
      };
    }
  }
}

export function toSaved(s: RoundState): SavedRound {
  return {
    code: s.code,
    roomSeed: s.roomSeed,
    roundNo: s.roundNo,
    calledCount: s.calledCount,
    settings: s.settings,
    winners: s.winners,
    langs: s.langs,
    phase: s.phase,
    assignments: s.assignments,
  };
}

export function calledCards(s: RoundState): CardId[] {
  return s.order.slice(0, s.calledCount);
}

export function currentCard(s: RoundState): CardId | undefined {
  return s.calledCount > 0 ? s.order[s.calledCount - 1] : undefined;
}

/** Language of call index i (0-based). Rotation cycles through s.langs. */
export function langForCall(s: Pick<RoundState, 'settings' | 'langs'>, i: number): Lang {
  const c = s.settings.callLang;
  if (c !== 'rotating') return c;
  const langs = s.langs.length ? s.langs : (['es'] as Lang[]);
  return langs[((i % langs.length) + langs.length) % langs.length] as Lang;
}

export interface ClaimOutcome {
  valid: boolean;
  missing: CardId[];
}

/** Pick a random tabla index not in `used` (0..MAX_TABLA_INDEX). */
export function pickTablaIndex(
  used: ReadonlySet<number>,
  rand: () => number = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32,
): number {
  if (used.size > MAX_TABLA_INDEX) throw new Error('no free tabla index');
  for (;;) {
    const i = Math.floor(rand() * (MAX_TABLA_INDEX + 1));
    if (!used.has(i)) return i;
  }
}

/**
 * Validate a phone claim against the index ASSIGNED to that seat for this round.
 * A different tablaIndex, an unassigned seat or a stale round is simply invalid.
 */
export function validateSeatClaim(
  s: RoundState,
  deck: DeckCard[],
  claim: { seat: string; roundNo: number; tablaIndex: number; marks: CardId[] },
): ClaimOutcome {
  const assigned = s.assignments[claim.seat];
  if (
    s.order.length === 0 ||
    claim.roundNo !== s.roundNo ||
    assigned === undefined ||
    assigned !== claim.tablaIndex
  ) {
    return { valid: false, missing: [] };
  }
  const r = checkClaim(
    tabla(s.roomSeed, assigned, deck),
    calledCards(s),
    s.settings.pattern,
    claim.marks,
  );
  return { valid: r.valid, missing: [...(r.missing ?? []), ...(r.unmarked ?? [])] };
}

export type PaperOutcome =
  | { kind: 'invalid' }
  | { kind: 'otherGame' }
  | { kind: 'valid'; index: number }
  | { kind: 'almost'; index: number; missing: CardId[] };

/** Validate a printed board's 6-char code (no marks involved). */
export function validatePaperCode(s: RoundState, deck: DeckCard[], code: string): PaperOutcome {
  const d = decodeTablaCode(code);
  if (!d.ok || d.index === undefined || d.seedRef === undefined) return { kind: 'invalid' };
  if (d.seedRef !== seedRef(s.roomSeed)) return { kind: 'otherGame' };
  const t = tabla(s.roomSeed, d.index, deck);
  const called = new Set(calledCards(s));
  const crossed = t.cards.filter((c) => called.has(c));
  return isCardComplete(t, crossed)
    ? { kind: 'valid', index: d.index }
    : { kind: 'almost', index: d.index, missing: t.cards.filter((c) => !called.has(c)) };
}

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomSeed(rand?: (n: number) => Uint8Array): string {
  const bytes = rand ? rand(8) : globalThis.crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => B32[b % 32]).join('');
}
