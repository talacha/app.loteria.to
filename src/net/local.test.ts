import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateHostKeyPair, generateHostKeys, signMsg } from './crypto.ts';
import { LocalTransport } from './local.ts';
import { getSeat } from './transport.ts';
import type { Msg } from './messages.ts';
import type { JoinOptions, Role } from './transport.ts';

const claim = (seat: string): Msg => ({ t: 'claim', seat, roundNo: 1, tablaIndex: 1, marks: [] });
const call: Msg = {
  t: 'call',
  i: 0,
  cardId: 'gallo',
  choices: ['gallo', 'luna', 'sol'],
  at: 1,
};
const round: Msg = {
  t: 'round',
  seed: 's',
  roundNo: 1,
  speedSec: 5,
};
const seatOf = (t: LocalTransport) => (t as unknown as { session: { seat: string } }).session.seat;
const flush = () => new Promise((r) => setTimeout(r, 25));

let open: LocalTransport[] = [];
let raws: BroadcastChannel[] = [];
let n = 0;
async function make(code: string, role: Role, opts?: JoinOptions) {
  const t = new LocalTransport(`seat${n++}`);
  await t.join(code, role, opts);
  open.push(t);
  return t;
}
function collect(t: LocalTransport) {
  const got: Msg[] = [];
  t.onMessage((m) => got.push(m));
  return got;
}
function raw(code: string) {
  const c = new BroadcastChannel('loteria:' + code);
  raws.push(c);
  return c;
}

afterEach(async () => {
  await Promise.all(open.map((t) => t.leave()));
  raws.forEach((c) => c.close());
  open = [];
  raws = [];
  vi.useRealTimers();
});

describe('LocalTransport', () => {
  it('delivers signed host messages to players and claims to host', async () => {
    const host = await make('A1', 'host');
    const player = await make('A1', 'player');
    const atPlayer = collect(player);
    const atHost = collect(host);
    host.send(round);
    host.send(call);
    const p = await make('A1', 'player'); // second player never sees the first's claim
    const atP2 = collect(p);
    player.send(claim(seatOf(player)));
    // Signing is async (ECDSA); slow build machines need more than a fixed sleep.
    await vi.waitFor(
      () => {
        expect(atPlayer.map((m) => m.t)).toEqual(['round', 'call']);
        expect(atHost.map((m) => m.t)).toEqual(['claim']);
      },
      { timeout: 3000, interval: 20 },
    );
    expect(atP2.filter((m) => m.t === 'claim')).toEqual([]);
  });

  it('queues send() until join completes', async () => {
    const player = await make('A2', 'player');
    const got = collect(player);
    const host = new LocalTransport('hq');
    open.push(host);
    const joined = host.join('A2', 'host');
    host.send(call);
    await joined;
    await flush();
    // no round seen yet and no pinned key: unpinned call is dropped by TOFU
    expect(got).toEqual([]);
    host.send(round);
    await flush();
    expect(got.map((m) => m.t)).toEqual(['round']);
  });

  it('drops forged-role and unsigned/badly signed host frames', async () => {
    const player = await make('A3', 'player');
    const got = collect(player);
    const r = raw('A3');
    r.postMessage({ k: 'msg', frame: { role: 'host', from: 'x', m: call } });
    r.postMessage({ k: 'msg', frame: { role: 'host', from: 'x', m: call, sig: 'AAAA' } });
    r.postMessage({
      k: 'msg',
      frame: { role: 'host', from: 'x', m: { ...round, hostKey: 'bogus' }, sig: 'AAAA' },
    });
    await flush();
    expect(got).toEqual([]);
  });

  it('reports an authenticated legacy host through onError with refresh guidance', async () => {
    const keys = await generateHostKeys();
    const player = await make('LEGACY', 'player', { hostKey: keys.pub });
    const got = collect(player);
    const errors: unknown[] = [];
    player.onError((error) => errors.push(error));
    raw('LEGACY').postMessage({
      k: 'msg',
      frame: { role: 'host', from: 'old-host', m: call, sig: await signMsg(keys.priv, call) },
    });
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]).toMatchObject({
      name: 'ProtocolVersionError',
      message: expect.stringMatching(/Refresh/),
    });
    expect(got).toEqual([]);
  });

  it('host drops host-only types and players drop claim/hello', async () => {
    const host = await make('A4', 'host');
    const other = await make('A4', 'host');
    const player = await make('A4', 'player');
    const atHost = collect(host);
    const atPlayer = collect(player);
    other.send(call);
    const r = raw('A4');
    r.postMessage({ k: 'msg', frame: { role: 'player', from: 'z', m: claim('z') } });
    await flush();
    expect(atHost.filter((m) => m.t === 'call')).toEqual([]);
    expect(atPlayer).toEqual([]);
  });

  it('TOFU pins the first host key and rejects a different one', async () => {
    const a = await make('A5', 'host');
    const b = await make('A5', 'host');
    const player = await make('A5', 'player');
    const got = collect(player);
    expect(player.isHostVerified()).toBe(false);
    a.send(round);
    await flush();
    b.send({ ...round, roundNo: 2 });
    b.send(call);
    a.send(call);
    await flush();
    expect(got.map((m) => m.t)).toEqual(['round', 'call']);
    expect(got.find((m) => m.t === 'round')).toMatchObject({ roundNo: 1 });
  });

  it('verifies against a supplied hostKey', async () => {
    const a = await make('A6', 'host');
    const b = await make('A6', 'host');
    const key = await a.hostPublicKey!();
    const player = await make('A6', 'player', { hostKey: key });
    const got = collect(player);
    expect(player.isHostVerified()).toBe(true);
    b.send(round);
    a.send(call);
    await flush();
    expect(got.map((m) => m.t)).toEqual(['call']);
  });

  it('ignores spoofed seats and rate limits per sender', async () => {
    const host = await make('A7', 'host');
    const atHost = collect(host);
    const r = raw('A7');
    const f = (from: string, seat: string) => ({
      k: 'msg',
      frame: { role: 'player', from, m: claim(seat) },
    });
    r.postMessage(f('a', 'a'));
    r.postMessage(f('b', 'a'));
    r.postMessage(f('c', 'a'));
    r.postMessage(f('a', 'a'));
    await flush();
    expect(atHost).toHaveLength(1);
  });

  it('rate limits claims 1 per 3 s per seat and 20/s globally', async () => {
    const host = await make('A8', 'host');
    const player = await make('A8', 'player');
    const atHost = collect(host);
    player.send(claim(seatOf(player)));
    player.send(claim(seatOf(player)));
    await flush();
    expect(atHost).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 3100);
    player.send(claim(seatOf(player)));
    await flush();
    expect(atHost).toHaveLength(2);
    const r = raw('A8');
    for (let i = 0; i < 30; i++)
      r.postMessage({ k: 'msg', frame: { role: 'player', from: 'p' + i, m: claim('p' + i) } });
    await flush();
    expect(atHost).toHaveLength(2 + 19 + 0); // one slot of the 20/s window already used by seat3
  });

  it('unsubscribe stops delivery', async () => {
    const host = await make('A9', 'host');
    const player = await make('A9', 'player');
    const got: Msg[] = [];
    const off = host.onMessage((m) => got.push(m));
    off();
    player.send(claim(seatOf(player)));
    await flush();
    expect(got).toEqual([]);
  });

  it('tracks player presence only, expires silent peers, and leave clears timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const host = await make('B1', 'host');
    const seen: string[][] = [];
    host.onPresence((s) => seen.push(s));
    const p = await make('B1', 'player');
    await flush();
    expect(seen.at(-1)).toEqual([seatOf(p)]);
    const silent = await make('B1', 'player');
    await flush();
    expect(seen.at(-1)).toHaveLength(2);
    // stop only the silent peer's heartbeat without a leave frame
    (silent as unknown as { ch: BroadcastChannel }).ch.postMessage = () => {};
    vi.advanceTimersByTime(8000);
    await flush();
    expect(seen.at(-1)).toEqual([seatOf(p)]);
  });

  it('leave emits [] and clears the heartbeat interval', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const t = await make('B2', 'player');
    const seen: string[][] = [];
    t.onPresence((s) => seen.push(s));
    expect(vi.getTimerCount()).toBe(1);
    await t.leave();
    expect(vi.getTimerCount()).toBe(0);
    expect(seen.at(-1)).toEqual([]);
  });
});

describe('v2 additions', () => {
  it('verifies signed assign and drops a forged one', async () => {
    const host = await make('C1', 'host');
    const player = await make('C1', 'player');
    const got = collect(player);
    host.send(round);
    host.send({ t: 'assign', seat: 'x', tablaIndex: 7, roundNo: 1 });
    await flush();
    const r = raw('C1');
    r.postMessage({
      k: 'msg',
      frame: {
        role: 'host',
        from: 'h',
        m: { t: 'assign', seat: 'x', tablaIndex: 8, roundNo: 1 },
        sig: 'AAAA',
      },
    });
    await flush();
    const assigns = got.filter((m) => m.t === 'assign');
    expect(assigns).toEqual([{ t: 'assign', seat: 'x', tablaIndex: 7, roundNo: 1 }]);
  });

  it('uses an injected seat as from and exposes it', async () => {
    const host = await make('C2', 'host');
    const atHost = collect(host);
    const p = new LocalTransport({ seat: 'injected' });
    open.push(p);
    await p.join('C2', 'player');
    expect(p.seat).toBe('injected');
    p.send(claim('injected'));
    p.send(claim('other'));
    await flush();
    expect(atHost.map((m) => (m as { seat: string }).seat)).toEqual(['injected']);
  });

  it('getSeat is stable when sessionStorage throws', () => {
    const boom = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
    };
    vi.stubGlobal('sessionStorage', boom);
    try {
      expect(getSeat('ZZZZZ', 'player')).toBe(getSeat('ZZZZZ', 'player'));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('an injected key pair yields the same hostPublicKey', async () => {
    const kp = await generateHostKeyPair();
    const a = new LocalTransport();
    const b = new LocalTransport();
    open.push(a, b);
    await a.join('C3', 'host', { keyPair: kp });
    await b.join('C4', 'host', { keyPair: kp });
    expect(await a.hostPublicKey()).toBe(await b.hostPublicKey());
  });

  it('delivers signed lobby and drops a forged one', async () => {
    const host = await make('C5', 'host');
    const player = await make('C5', 'player');
    const got = collect(player);
    host.send(round);
    host.send({ t: 'lobby', status: 'waiting', players: [{ seat: 'a', name: 'Ana', glyph: '*' }] });
    await flush();
    raw('C5').postMessage({
      k: 'msg',
      frame: {
        role: 'host',
        from: 'h',
        m: { t: 'lobby', status: 'started', players: [] },
        sig: 'AAAA',
      },
    });
    await flush();
    expect(got.filter((m) => m.t === 'lobby')).toHaveLength(1);
  });

  it('TOFU pins the host key from a lobby', async () => {
    const a = await make('C6', 'host');
    const b = await make('C6', 'host');
    const player = await make('C6', 'player');
    const got = collect(player);
    const lobby: Msg = { t: 'lobby', status: 'waiting', players: [] };
    a.send(lobby);
    await flush();
    a.send(round);
    b.send(lobby);
    await flush();
    expect(got.map((m) => m.t)).toEqual(['lobby', 'round']);
  });

  it('drops a forged pickResult and rate limits picks', async () => {
    const host = await make('C7', 'host');
    const player = await make('C7', 'player');
    const gotP = collect(player);
    const gotH = collect(host);
    host.send(round);
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: 'a',
      correct: true,
      points: 2,
      first: true,
    });
    await flush();
    raw('C7').postMessage({
      k: 'msg',
      frame: {
        role: 'host',
        from: 'h',
        m: { t: 'pickResult', roundNo: 1, i: 1, seat: 'a', correct: true, points: 2, first: true },
        sig: 'AAAA',
      },
    });
    await flush();
    expect(gotP.filter((m) => m.t === 'pickResult')).toHaveLength(1);

    const pick = (i: number): Msg => ({
      t: 'pick',
      seat: seatOf(player),
      roundNo: 1,
      i,
      cardId: 'x',
    });
    player.send(pick(0));
    player.send(pick(0)); // within 400 ms: dropped
    await flush();
    expect(gotH.filter((m) => m.t === 'pick')).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let k = 1; k <= 5; k++) {
      vi.setSystemTime(Date.now() + 500);
      player.send(pick(0));
      await flush();
    }
    expect(gotH.filter((m) => m.t === 'pick')).toHaveLength(2); // cap of 2 per (round, i)
    // spoofed seat dropped
    vi.setSystemTime(Date.now() + 500);
    player.send({ t: 'pick', seat: 'someone-else', roundNo: 1, i: 2, cardId: 'x' });
    await flush();
    expect(gotH.filter((m) => m.t === 'pick')).toHaveLength(2);
  });
});
