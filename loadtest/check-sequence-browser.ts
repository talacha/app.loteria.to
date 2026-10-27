/** Real-browser replay-storage regression: pnpm tsx loadtest/check-sequence-browser.ts */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { sleep } from './common.ts';
import type * as SessionModule from '../src/net/session.ts';
import type * as SequenceModule from '../src/net/sequence.ts';
import type * as CryptoModule from '../src/net/crypto.ts';
import type * as PersistModule from '../src/app/host/persist.ts';

const port = Number(process.env.LOADTEST_SEQUENCE_PORT ?? 4198);
const base = `http://localhost:${port}`;
const server = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'ignore' },
);
const assert = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (server.exitCode !== null)
      throw new Error(
        'Sequence test Vite server failed to start; choose another LOADTEST_SEQUENCE_PORT.',
      );
    try {
      ready = (await fetch(base)).ok;
    } catch {
      /* starting */
    }
    if (ready) break;
  }
  assert(ready, 'Sequence test server did not start');
  browser = await chromium.launch();
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  await Promise.all([a.goto(base), b.goto(base)]);
  const values = await Promise.all(
    [a, b].map((page) =>
      page.evaluate(async () => {
        const path = '/src/net/sequence.ts';
        const { sequenceStore } = (await import(path)) as typeof SequenceModule;
        return Promise.all(
          Array.from({ length: 10 }, () => sequenceStore().next('tx:browser-proof')),
        );
      }),
    ),
  );
  const nums = values.flat().sort((x, y) => x - y);
  assert(
    nums.join() === Array.from({ length: 20 }, (_, i) => i + 1).join(),
    'Concurrent IDB allocation must be unique and monotonic',
  );
  const accepted = await Promise.all(
    [a, b].map((page) =>
      page.evaluate(async () => {
        const path = '/src/net/sequence.ts';
        const { sequenceStore } = (await import(path)) as typeof SequenceModule;
        return sequenceStore().accept('rx:browser-proof', 50);
      }),
    ),
  );
  assert(accepted.filter(Boolean).length === 1, 'Duplicate receiver acceptance must be atomic');
  const old = await a.evaluate(async () => {
    const sessionPath = '/src/net/session.ts';
    const cryptoPath = '/src/net/crypto.ts';
    const persistPath = '/src/app/host/persist.ts';
    const { Session } = (await import(sessionPath)) as typeof SessionModule;
    const { generateHostKeyPair } = (await import(cryptoPath)) as typeof CryptoModule;
    const { saveKeyPair } = (await import(persistPath)) as typeof PersistModule;
    const keyPair = await generateHostKeyPair();
    await saveKeyPair('REPLAYTEST', keyPair);
    const host = new Session();
    await host.start('REPLAYTEST', 'host', { keyPair }, 'browser-host');
    const hostKey = await host.publicKey();
    const player = new Session();
    await player.start('REPLAYTEST', 'player', { hostKey }, 'browser-player');
    const frame = await host.encode({ t: 'round', seed: 'browser-proof', roundNo: 1, speedSec: 6 });
    if (!(await player.decode(frame))) throw new Error('Initial signed frame rejected');
    return { frame, hostKey };
  });
  await a.reload();
  const restarted = await a.evaluate(async ({ frame, hostKey }) => {
    const sessionPath = '/src/net/session.ts';
    const persistPath = '/src/app/host/persist.ts';
    const { Session } = (await import(sessionPath)) as typeof SessionModule;
    const { loadKeyPair } = (await import(persistPath)) as typeof PersistModule;
    const keyPair = await loadKeyPair('REPLAYTEST');
    if (!keyPair) throw new Error('Host key was not persisted');
    const host = new Session();
    await host.start('REPLAYTEST', 'host', { keyPair }, 'browser-host');
    const player = new Session();
    await player.start('REPLAYTEST', 'player', { hostKey }, 'browser-player');
    if ((await player.decode(frame)) !== null) throw new Error('Reload accepted a replay');
    const next = await host.encode({ t: 'round', seed: 'browser-proof', roundNo: 1, speedSec: 6 });
    if (next.seq! <= frame.seq! || !(await player.decode(next)))
      throw new Error('Host counter reset after reload');
    return { old: frame.seq, next: next.seq };
  }, old);
  const blocked = await browser.newContext();
  const c = await blocked.newPage();
  await c.goto(base);
  const failure = await c.evaluate(async () => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new Error('storage blocked');
      },
    });
    const path = '/src/net/sequence.ts';
    const { sequenceStore } = (await import(path)) as typeof SequenceModule;
    try {
      await sequenceStore().next('tx:must-fail');
      return 'unsafe-fallback';
    } catch (error) {
      return (error as Error).name;
    }
  });
  assert(failure === 'SequenceStorageError', 'Browser storage must fail closed');
  console.log(
    JSON.stringify(
      {
        browser: 'chromium',
        concurrentAllocations: nums.length,
        unique: new Set(nums).size,
        atomicAccept: accepted,
        reload: restarted,
        blockedStorage: failure,
        pass: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
