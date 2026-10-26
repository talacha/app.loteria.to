import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalTransport } from './local.ts';
import type { Msg } from './messages.ts';
import type { JoinOptions, Role } from './transport.ts';

const claim = (seat: string): Msg => ({ t: 'claim', seat, tablaIndex: 1, marks: [] });
const call: Msg = { t: 'call', i: 0, cardId: 'gallo', lang: 'es', at: 1 };
const round: Msg = {
  t: 'round',
  seed: 's',
  roundNo: 1,
  mode: 'normal',
  pattern: 'line',
  callLang: 'es',
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
    await flush();
    expect(atPlayer.map((m) => m.t)).toEqual(['round', 'call']);
    expect(atHost.map((m) => m.t)).toEqual(['claim']);
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
