import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { SavedRound } from './roundMachine';

const DB = 'loteria-host';
const STATE = 'state';
const KEYS = 'keys';
const ASSIGN = 'assignments';
const KEY = 'round';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB, 2, {
    upgrade(d) {
      for (const n of [STATE, KEYS, ASSIGN]) {
        if (!d.objectStoreNames.contains(n)) d.createObjectStore(n);
      }
    },
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

// Writes are serialized; clear bumps `epoch` so puts queued before it are skipped.
let queue: Promise<unknown> = Promise.resolve();
let epoch = 0;

function enqueue(fn: () => Promise<void>, guard = true): Promise<void> {
  const mine = epoch;
  const p = queue.then(async () => {
    if (guard && mine !== epoch) return;
    try {
      await fn();
    } catch {
      /* best-effort: storage failures never block calling */
    }
  });
  queue = p;
  return p;
}

export function saveRound(s: SavedRound): Promise<void> {
  const { assignments, ...rest } = s;
  return enqueue(async () => {
    const d = await db();
    const tx = d.transaction([STATE, ASSIGN], 'readwrite');
    await Promise.all([
      tx.objectStore(STATE).put(rest, KEY),
      tx.objectStore(ASSIGN).put(assignments ?? {}, KEY),
      tx.done,
    ]);
  });
}

export async function loadRound(): Promise<SavedRound | null> {
  try {
    await queue;
    const d = await db();
    const v = (await d.get(STATE, KEY)) as SavedRound | undefined;
    if (!v || typeof v.code !== 'string' || typeof v.roomSeed !== 'string') return null;
    const assignments = ((await d.get(ASSIGN, KEY)) as Record<string, number> | undefined) ?? {};
    return { ...v, assignments };
  } catch {
    return null;
  }
}

export function clearRound(): Promise<void> {
  epoch++;
  return enqueue(async () => {
    const d = await db();
    await d.delete(STATE, KEY);
    await d.delete(ASSIGN, KEY);
  }, false);
}

export async function loadKeyPair(code: string): Promise<CryptoKeyPair | null> {
  try {
    await queue;
    return ((await (await db()).get(KEYS, code)) as CryptoKeyPair | undefined) ?? null;
  } catch {
    return null;
  }
}

export function saveKeyPair(code: string, kp: CryptoKeyPair): Promise<void> {
  return enqueue(async () => {
    await (await db()).put(KEYS, kp, code);
  }, false);
}
