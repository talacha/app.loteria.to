import type { Msg } from './msg';

export type Lang = 'es' | 'en' | 'nah' | 'yua' | 'quz';
export type CardId = string;
export type Category = 'animals' | 'plants_food' | 'sky' | 'land' | 'handmade' | 'places';
export type PatternId = 'line' | 'square' | 'corners' | 'center' | 'ele' | 'x' | 'frame' | 'full';
export type Level = 'easy' | 'medium' | 'hard' | 'any';
export interface Tabla {
  index: number;
  cards: CardId[]; // 16, row-major 4x4
}

export interface RoundSettings {
  pattern: PatternId | { surprise: Level };
  callLang: Lang | 'rotating';
  speedSec: number;
  mode: 'normal' | 'escucha';
}
export interface SeatInfo {
  seat: string;
  name: string;
  glyph: string;
  pronouns?: string;
  labelLang: Lang;
  tablaIndex: number;
}
export interface RoomState {
  code: string;
  seed: string;
  deckSecret: string; // R-09: never leaves the host
  roundNo: number;
  settings: RoundSettings;
  round: null | {
    pattern: PatternId;
    order: CardId[];
    called: number;
    status: 'running' | 'paused' | 'claimPause' | 'ended';
    winners: string[];
  };
  seats: Record<string, SeatInfo>;
  lastClaimAt: Record<string, number>;
  takenIndices: number[];
}
export type HostEvent =
  | { type: 'startRound'; settings: RoundSettings }
  | { type: 'next'; now?: number }
  | { type: 'repeat' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end' }
  | { type: 'msg'; msg: Msg; now: number };
export type Effect =
  | { type: 'speak'; cardId: CardId; lang: Lang; withVerse: boolean }
  | { type: 'claim'; seat: string; valid: boolean; cells?: number[]; missing?: CardId[] }
  | { type: 'roundEnded'; winners: string[] };
export interface HostOutput {
  state: RoomState;
  send: Msg[];
  effects: Effect[];
}
