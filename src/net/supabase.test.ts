import { beforeEach, describe, expect, it, vi } from 'vitest';

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT';
const state = { status: 'SUBSCRIBED' as Status, track: 'ok' as string };
const handlers: Record<string, (p: unknown) => void> = {};
const channel = {
  on: vi.fn((type: string, filter: { event: string }, cb: (p: unknown) => void) => {
    handlers[type + ':' + filter.event] = cb;
    return channel;
  }),
  subscribe: vi.fn((cb: (s: string) => void) => {
    queueMicrotask(() => cb(state.status));
    return channel;
  }),
  track: vi.fn(async () => state.track),
  send: vi.fn(async () => 'ok'),
  presenceState: vi.fn(() => ({ h: [{ role: 'host' }], p1: [{ role: 'player' }] })),
};
const client = { channel: vi.fn(() => channel), removeChannel: vi.fn(async () => 'ok') };
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => client) }));

const { SupabaseTransport } = await import('./supabase.ts');

beforeEach(() => {
  state.status = 'SUBSCRIBED';
  state.track = 'ok';
  vi.clearAllMocks();
});

describe('SupabaseTransport', () => {
  it('joins, sends signed frames, lists players, and leaves', async () => {
    const t = new SupabaseTransport('u', 'k', 'h');
    await t.join('ABCDE', 'host');
    expect(client.channel).toHaveBeenCalledWith('loteria:ABCDE', {
      config: { broadcast: { self: false }, presence: { key: 'h' } },
    });
    expect(channel.track).toHaveBeenCalledWith({ role: 'host' });
    const seats: string[][] = [];
    t.onPresence((s) => seats.push(s));
    handlers['presence:sync']!({});
    expect(seats).toEqual([['p1']]);

    t.send({ t: 'end', roundNo: 1, winners: [], reason: 'full-card' });
    await vi.waitFor(() => expect(channel.send).toHaveBeenCalled());
    const arg = (
      channel.send.mock.calls[0] as unknown as [
        { event: string; payload: { sig?: string; from: string } },
      ]
    )[0];
    expect(arg.event).toBe('msg');
    expect(arg.payload.from).toBe('h');
    expect(arg.payload.sig).toBeTruthy();

    await t.leave();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('delivers broadcast payloads through the policy', async () => {
    const t = new SupabaseTransport('u', 'k', 'h');
    await t.join('ABCDE', 'host');
    const got: unknown[] = [];
    t.onMessage((m) => got.push(m));
    const claim = { t: 'claim', seat: 'p1', roundNo: 1, tablaIndex: 1, marks: [] };
    handlers['broadcast:msg']!({ payload: { role: 'player', from: 'p1', m: claim } });
    handlers['broadcast:msg']!({ payload: { role: 'player', from: 'other', m: claim } });
    await vi.waitFor(() => expect(got).toHaveLength(1));
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT'] as const)(
    'rejects and removes channel on %s',
    async (s) => {
      state.status = s;
      const t = new SupabaseTransport('u', 'k', 'h');
      await expect(t.join('ABCDE', 'player')).rejects.toThrow();
      expect(client.removeChannel).toHaveBeenCalled();
    },
  );

  it('rejects when track does not return ok', async () => {
    state.track = 'error';
    const t = new SupabaseTransport('u', 'k', 'h');
    await expect(t.join('ABCDE', 'player')).rejects.toThrow(/track/);
  });

  it('reports send failures via onError', async () => {
    const t = new SupabaseTransport('u', 'k', 'h');
    await t.join('ABCDE', 'host');
    const errs: unknown[] = [];
    t.onError((e) => errs.push(e));
    channel.send.mockResolvedValueOnce('error');
    t.send({ t: 'end', roundNo: 1, winners: [], reason: 'full-card' });
    await vi.waitFor(() => expect(errs).toHaveLength(1));
  });
});
