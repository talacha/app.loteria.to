import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateHostKeyPair, generateHostKeys, signMsg } from './crypto.ts';
import type { Msg } from './messages.ts';
import { PROTOCOL_VERSION, ProtocolVersionError, Session } from './session.ts';
import { SequenceStorageError, sequenceStore } from './sequence.ts';
import type { SequenceStore } from './sequence.ts';

const call: Msg = { t: 'call', i: 0, cardId: 'a', choices: ['a', 'b', 'c'], at: 1 };
const round: Msg = { t: 'round', seed: 's', roundNo: 1, speedSec: 6 };

async function pair() {
  const keyPair = await generateHostKeyPair();
  const host = new Session();
  await host.start('ABCDE', 'host', { keyPair }, 'host');
  const hostKey = await host.publicKey();
  const player = new Session();
  await player.start('ABCDE', 'player', { hostKey }, 'player');
  return { host, player, hostKey, keyPair };
}

afterEach(() => vi.unstubAllGlobals());

describe('versioned signed host envelopes', () => {
  it('rejects replay, reordering, payload/sequence/version tampering, and invalid sequences', async () => {
    const { host, player, keyPair } = await pair();
    const first = await host.encode(round);
    const second = await host.encode(call);
    expect(await player.decode(second)).toEqual(call);
    expect(await player.decode(second)).toBeNull();
    expect(await player.decode(first)).toBeNull();
    const next = await host.encode(call);
    expect(await player.decode({ ...next, seq: next.seq! + 1000 })).toBeNull();
    expect(await player.decode({ ...next, m: { ...call, i: 5 } })).toBeNull();
    expect(await player.decode({ ...next, v: 1 })).toBeNull();
    const keys = await generateHostKeys(keyPair);
    for (const seq of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
      const envelope = { v: PROTOCOL_VERSION, seq, m: call };
      expect(
        await player.decode({ ...next, ...envelope, sig: await signMsg(keys.priv, envelope) }),
      ).toBeNull();
    }
    // Forged high seq did not poison the durable high-water mark.
    expect(await player.decode(next)).toEqual(call);
  });

  it('continues sender sequences after restart with the same persisted key', async () => {
    const { host, player, keyPair } = await pair();
    const old = await host.encode(call);
    expect(await player.decode(old)).toEqual(call);
    const restarted = new Session();
    await restarted.start('ABCDE', 'host', { keyPair }, 'host');
    const next = await restarted.encode(call);
    expect(next.seq).toBeGreaterThan(old.seq!);
    expect(await player.decode(next)).toEqual(call);
  });

  it('persists receiver high-water by host key and stable seat across reloads', async () => {
    const { host, player, hostKey } = await pair();
    const old = await host.encode(call);
    expect(await player.decode(old)).toEqual(call);
    const reloaded = new Session();
    await reloaded.start('ABCDE', 'player', { hostKey }, 'player');
    expect(await reloaded.decode(old)).toBeNull();
    expect(await reloaded.decode(await host.encode(call))).toEqual(call);
    const otherSeat = new Session();
    await otherSeat.start('ABCDE', 'player', { hostKey }, 'other-player');
    expect(await otherSeat.decode(old)).toEqual(call);
  });

  it('serializes concurrent encodes and reserves unique sequences across same-key sessions', async () => {
    const { host, keyPair } = await pair();
    const frames = await Promise.all(Array.from({ length: 12 }, () => host.encode(call)));
    expect(frames.map((f) => f.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    const other = new Session();
    await other.start('ABCDE', 'host', { keyPair }, 'other-host');
    const mixed = await Promise.all([host.encode(call), other.encode(call), host.encode(call)]);
    expect(new Set(mixed.map((f) => f.seq)).size).toBe(3);
    expect(mixed[2]!.seq).toBeGreaterThan(mixed[0]!.seq!);
  });

  it('reports authenticated legacy hosts and never falls back to unsigned sequencing', async () => {
    const { player, keyPair } = await pair();
    const keys = await generateHostKeys(keyPair);
    const legacy = { role: 'host', from: 'host', m: call, sig: await signMsg(keys.priv, call) };
    await expect(player.decode(legacy)).rejects.toBeInstanceOf(ProtocolVersionError);
    expect(await player.decode({ ...legacy, sig: 'AAAA' })).toBeNull();
  });

  it('reports authenticated v2 hosts even when the future/old payload has unrecognized fields', async () => {
    const { host, player, keyPair } = await pair();
    expect((await host.encode(round)).v).toBe(3);
    const keys = await generateHostKeys(keyPair);
    const envelope = {
      v: 2,
      seq: 1,
      m: { ...round, futureField: 'must not be stripped before verification' },
    };
    await expect(
      player.decode({
        role: 'host',
        from: 'old-host',
        ...envelope,
        sig: await signMsg(keys.priv, envelope),
      }),
    ).rejects.toBeInstanceOf(ProtocolVersionError);
  });

  it('does not pin a TOFU key until a valid versioned frame has been accepted', async () => {
    const { host, keyPair } = await pair();
    const player = new Session();
    await player.start('ABCDE', 'player', undefined, 'tofu');
    const keys = await generateHostKeys(keyPair);
    const legacy = { ...round, hostKey: keys.pub };
    await expect(
      player.decode({
        role: 'host',
        from: 'host',
        m: legacy,
        sig: await signMsg(keys.priv, legacy),
      }),
    ).rejects.toBeInstanceOf(ProtocolVersionError);
    expect(await player.decode(await host.encode(round))).toMatchObject({ t: 'round' });
  });

  it('fails closed when persistence fails, before sending or delivering', async () => {
    const { hostKey } = await pair();
    const broken: SequenceStore = {
      next: async () => {
        throw new SequenceStorageError();
      },
      accept: async () => {
        throw new SequenceStorageError();
      },
    };
    const host = new Session(undefined, broken);
    await host.start('ABCDE', 'host', undefined, 'host');
    await expect(host.encode(call)).rejects.toBeInstanceOf(SequenceStorageError);
    const p = new Session(undefined, broken);
    await p.start('ABCDE', 'player', { hostKey }, 'player');
    const sender = new Session();
    await sender.start('ABCDE', 'host');
    await p.start('ABCDE', 'player', { hostKey: await sender.publicKey() }, 'player');
    await expect(p.decode(await sender.encode(call))).rejects.toBeInstanceOf(SequenceStorageError);
  });

  it('does not silently use Node memory in a browser without IndexedDB', async () => {
    vi.stubGlobal('process', undefined);
    vi.stubGlobal('indexedDB', undefined);
    await expect(sequenceStore().next('browser-key')).rejects.toBeInstanceOf(SequenceStorageError);
    await expect(sequenceStore().accept('browser-seat', 1)).rejects.toBeInstanceOf(
      SequenceStorageError,
    );
  });
});
