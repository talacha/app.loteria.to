import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CardId, Category } from '@engine';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Tiny .env parser. Never prints values. Does not override real env. */
export function loadEnv(file = root + '.env.local'): void {
  let txt = '';
  try {
    txt = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of txt.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2] ?? '';
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1] as string] === undefined) process.env[m[1] as string] = v;
  }
}

export function supabaseCreds(): { url: string; key: string } | null {
  const e = process.env;
  const url = e.VITE_SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    e.VITE_SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return url && key ? { url: url.trim(), key: key.trim() } : null;
}

export function cardPool(): { id: CardId; category: Category }[] {
  type Raw = { id: string; category: Category }[] | { cards: { id: string; category: Category }[] };
  let raw: Raw;
  try {
    raw = JSON.parse(readFileSync(root + 'src/content/cards.json', 'utf8')) as Raw;
  } catch {
    // Working copy mid-edit (e.g. merge markers): fall back to the committed deck.
    raw = JSON.parse(
      execFileSync('git', ['show', 'HEAD:src/content/cards.json'], { cwd: root, maxBuffer: 1 << 26 }).toString(),
    ) as Raw;
  }
  const list = Array.isArray(raw) ? raw : raw.cards;
  return list.map((c) => ({ id: c.id, category: c.category }));
}

export function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] as number;
}

export function stats(xs: number[]): { n: number; p50: number; p95: number; max: number } {
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, p50: pct(s, 50), p95: pct(s, 95), max: s.length ? (s[s.length - 1] as number) : NaN };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Per-second frame counters for quota comparison. */
export class Wire {
  tx = 0;
  rx = 0;
  txBytes = 0;
  txSec = new Map<number, number>();
  rxSec = new Map<number, number>();
  onTx(frame: unknown): void {
    this.tx++;
    try {
      this.txBytes += JSON.stringify(frame).length;
    } catch {
      /* ignore */
    }
    const s = Math.floor(Date.now() / 1000);
    this.txSec.set(s, (this.txSec.get(s) ?? 0) + 1);
  }
  onRx(): void {
    this.rx++;
    const s = Math.floor(Date.now() / 1000);
    this.rxSec.set(s, (this.rxSec.get(s) ?? 0) + 1);
  }
}
