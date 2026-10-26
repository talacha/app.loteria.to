import { hashString } from './rng';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SEED_BITS = 13;
const INDEX_BITS = 12;
export const MAX_TABLA_INDEX = (1 << INDEX_BITS) - 1;

/**
 * A few bits (13) of the seed hash embedded in tabla codes. Weak hint only: the host must
 * verify `decoded.seedRef === seedRef(roomSeed)` and then call `tabla(roomSeed, index)`.
 */
export function seedRef(seed: string): number {
  return hashString(seed) & ((1 << SEED_BITS) - 1);
}

/** Multiply by x in GF(32) (modulus x^5 + x^2 + 1). */
function mulX(v: number): number {
  const r = v << 1;
  return r & 32 ? (r ^ 0x25) & 31 : r;
}

/**
 * Polynomial check over GF(32): s = fold(s -> x*s XOR v). The check symbol is x*s of the
 * 5 payload symbols, so the full 6-symbol fold is 0. Detects every single-symbol
 * substitution and every adjacent transposition (difference is (x+1)*(a-b)*x^m != 0).
 */
function checksum(values: number[]): number {
  let s = 0;
  for (const v of values) s = mulX(s) ^ v;
  return mulX(s);
}

export function tablaCode(seed: string, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > MAX_TABLA_INDEX) {
    throw new RangeError(`tablaCode: index must be an integer in 0..${MAX_TABLA_INDEX}`);
  }
  const payload = seedRef(seed) * (1 << INDEX_BITS) + index; // 25 bits
  const values: number[] = [];
  for (let i = 4; i >= 0; i--) values.push(Math.floor(payload / 32 ** i) % 32);
  values.push(checksum(values));
  return values.map((v) => CROCKFORD[v]).join('');
}

export function decodeTablaCode(code: string): { ok: boolean; seedRef?: number; index?: number } {
  if (typeof code !== 'string') return { ok: false };
  const norm = code
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (norm.length !== 6) return { ok: false };
  const values: number[] = [];
  for (const ch of norm) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) return { ok: false };
    values.push(v);
  }
  const check = values.pop() as number;
  if (checksum(values) !== check) return { ok: false };
  const payload = values.reduce((acc, v) => acc * 32 + v, 0);
  return {
    ok: true,
    seedRef: Math.floor(payload / (1 << INDEX_BITS)),
    index: payload % (1 << INDEX_BITS),
  };
}

export function roomCode(rng: () => number = Math.random): string {
  const n = ROOM_ALPHABET.length;
  let s = '';
  for (let i = 0; i < 5; i++) {
    const x = rng();
    const k = Number.isFinite(x) && x > 0 ? Math.min(n - 1, Math.floor(x * n)) : 0;
    s += ROOM_ALPHABET[k];
  }
  return s;
}
