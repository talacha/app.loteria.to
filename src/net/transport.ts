import type { Msg } from './messages.ts';

export type { Msg };
export type Role = 'host' | 'player';

export interface JoinOptions {
  /** Pinned host public key (base64url raw P-256). Without it players use trust-on-first-use. */
  hostKey?: string;
  /** Host only: reuse a persisted key pair instead of generating one. */
  keyPair?: CryptoKeyPair;
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
  /** This transport's seat id (valid after join). */
  readonly seat: string;
}

export interface TransportOptions {
  seat?: string;
}

export const CLAIM_INTERVAL_MS = 3000;
export const MAX_CLAIMS_PER_SEC = 20;
export const PICK_INTERVAL_MS = 400;
export const MAX_PICKS_PER_CALL = 4;

const memorySeats = new Map<string, string>();

/** Random seat id per join; stable for the page session even if sessionStorage throws. */
export function getSeat(code: string, role: Role): string {
  const key = `loteria:seat:${code}:${role}`;
  const cached = memorySeats.get(key);
  if (cached) return cached;
  let id: string | null = null;
  try {
    id = globalThis.sessionStorage?.getItem(key) ?? null;
  } catch {
    /* storage unavailable */
  }
  if (!id) {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try {
      globalThis.sessionStorage?.setItem(key, id);
    } catch {
      /* ignore */
    }
  }
  memorySeats.set(key, id);
  return id;
}
