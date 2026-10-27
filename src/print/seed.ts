const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** New 8-char Crockford base32 print seed (40 bits of randomness). */
export function newSeed(random: (n: number) => Uint8Array = randomBytes): string {
  const bytes = random(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += CROCKFORD[(bytes[i] as number) & 31];
  return s;
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}

/**
 * The one print-seed contract (shared by /print and the host): trim, uppercase, drop spaces and
 * hyphens, read O as 0 and I/L as 1, then require exactly 8 Crockford base32 characters.
 */
export function normalizePrintSeed(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(s) ? s : null;
}

/** Alias kept for the ?seed= query parameter. */
export function parseSeed(raw: string | null | undefined): string | null {
  return normalizePrintSeed(raw);
}
