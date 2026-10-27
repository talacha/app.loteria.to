import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

export class SequenceStorageError extends Error {
  constructor() {
    super('Replay protection storage is unavailable. Restore browser storage and refresh.');
    this.name = 'SequenceStorageError';
  }
}

export interface SequenceStore {
  /** Reserve and persist the next sender sequence before signing. */
  next(key: string): Promise<number>;
  /** Atomically persist an authenticated receiver high-water mark; false means replay. */
  accept(key: string, seq: number): Promise<boolean>;
}

function counter(value: unknown): number {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new SequenceStorageError();
  return value as number;
}

// Node-only harness/tests. Browsers never fall back to process memory after a storage failure.
const memory = new Map<string, number>();
const memoryStore: SequenceStore = {
  async next(key) {
    const current = counter(memory.get(key));
    if (current >= Number.MAX_SAFE_INTEGER) throw new SequenceStorageError();
    memory.set(key, current + 1);
    return current + 1;
  },
  async accept(key, seq) {
    if (seq <= counter(memory.get(key))) return false;
    memory.set(key, seq);
    return true;
  },
};

let database: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  database ??= openDB('loteria-sequences', 1, {
    upgrade(d) {
      d.createObjectStore('counters');
    },
    terminated() {
      database = null;
    },
  }).catch((error: unknown) => {
    database = null;
    throw error;
  });
  return database;
}

const browserStore: SequenceStore = {
  async next(key) {
    try {
      const d = await db();
      // IDB read/write transactions serialize across connections/tabs for this object store.
      const tx = d.transaction('counters', 'readwrite', { durability: 'strict' });
      // Attach rejection handling immediately; a failed request also aborts tx.done.
      void tx.done.catch(() => undefined);
      const current = counter(await tx.store.get(key));
      if (current >= Number.MAX_SAFE_INTEGER) {
        tx.abort();
        await tx.done.catch(() => undefined);
        throw new SequenceStorageError();
      }
      await tx.store.put(current + 1, key);
      await tx.done;
      return current + 1;
    } catch {
      throw new SequenceStorageError();
    }
  },
  async accept(key, seq) {
    try {
      const d = await db();
      const tx = d.transaction('counters', 'readwrite', { durability: 'strict' });
      // Attach rejection handling immediately; a failed request also aborts tx.done.
      void tx.done.catch(() => undefined);
      const current = counter(await tx.store.get(key));
      if (seq <= current) {
        await tx.done;
        return false;
      }
      await tx.store.put(seq, key);
      await tx.done;
      return true;
    } catch {
      throw new SequenceStorageError();
    }
  },
};

export function sequenceStore(): SequenceStore {
  return typeof process !== 'undefined' && process.versions?.node ? memoryStore : browserStore;
}
