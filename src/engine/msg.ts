import type { CardId, Lang, PatternId } from './types';

/** Pure wire-message types (00-SHARED section 4). `src/net` re-exports these. */
export interface RoundFields {
  seed: string;
  roundNo: number;
  pattern: PatternId;
  mode: 'normal' | 'escucha';
  callLang: Lang | 'rotating';
  speedSec: number;
}
export type Msg =
  | ({ t: 'round' } & RoundFields)
  | { t: 'call'; i: number; cardId: CardId; lang: Lang; at: number }
  | { t: 'claimResult'; seat: string; valid: boolean; missing?: CardId[] }
  | { t: 'end'; winners: string[] }
  | { t: 'welcome'; seat: string; tablaIndex: number; round: RoundFields | null; called: CardId[] }
  | { t: 'hello'; seat: string; name: string; glyph: string; pronouns?: string; labelLang: Lang }
  | { t: 'claim'; seat: string; tablaIndex: number; marks: CardId[] };
