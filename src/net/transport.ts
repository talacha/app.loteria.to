import type { Msg } from './messages.ts';

export type { Msg };
export type Role = 'host' | 'player';

export interface JoinOptions {
  /** Pinned host public key (base64url raw P-256). Without it players use trust-on-first-use. */
  hostKey?: string;
}

export interface Transport {
  join(code: string, role: Role, opts?: JoinOptions): Promise<void>;
  send(m: Msg): void;
  onMessage(cb: (m: Msg) => void): () => void;
  /** Player seats only (the host is never listed). */
  onPresence(cb: (seats: string[]) => void): () => void;
  onError?(cb: (e: unknown) => void): () => void;
  leave(): Promise<void>;
  /** Host only: base64url raw public key, to share out of band (e.g. in a QR). */
  hostPublicKey?(): Promise<string>;
  /** Player: true only when a hostKey was supplied at join (false while trust-on-first-use). */
  isHostVerified(): boolean;
}

export const CLAIM_INTERVAL_MS = 3000;
export const MAX_CLAIMS_PER_SEC = 20;

/** Random seat id per join, kept in sessionStorage under `${code}:${role}` when available. */
export function getSeat(code: string, role: Role): string {
  const key = `loteria:seat:${code}:${role}`;
  try {
    const existing = globalThis.sessionStorage?.getItem(key);
    if (existing) return existing;
  } catch {
    /* storage unavailable */
  }
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    globalThis.sessionStorage?.setItem(key, id);
  } catch {
    /* ignore */
  }
  return id;
}
