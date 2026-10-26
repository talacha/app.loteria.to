import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { BaseTransport } from './base.ts';
import type { Frame } from './session.ts';

export class SupabaseTransport extends BaseTransport {
  private client: SupabaseClient | null = null;
  private ch: RealtimeChannel | null = null;

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    fixedSeat?: string,
  ) {
    super(fixedSeat);
  }

  protected async connect(code: string, gen: number): Promise<void> {
    if (!this.client) {
      const { createClient } = await import('@supabase/supabase-js');
      this.client = createClient(this.url, this.anonKey);
    }
    if (gen !== this.gen) return;
    const client = this.client;
    const ch = client.channel('loteria:' + code, {
      config: { broadcast: { self: false }, presence: { key: this.session.seat } },
    });
    this.ch = ch;
    ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload?: unknown }) =>
      this.deliver(payload, gen),
    );
    ch.on('presence', { event: 'sync' }, () => {
      if (gen !== this.gen) return;
      const state = ch.presenceState() as Record<string, { role?: string }[]>;
      const seats = Object.entries(state)
        .filter(([, metas]) => metas.some((p) => p.role === 'player'))
        .map(([k]) => k)
        .sort();
      this.emitPresence(seats);
    });
    await new Promise<void>((resolve, reject) => {
      ch.subscribe((status: string) => {
        if (gen !== this.gen) return;
        if (status === 'SUBSCRIBED') {
          ch.track({ role: this.session.role }).then(
            (r: string) =>
              r === 'ok' ? resolve() : reject(new Error('presence track failed: ' + r)),
            reject,
          );
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void client
            .removeChannel(ch)
            .finally(() => reject(new Error('supabase channel ' + status)));
        }
      });
    });
  }

  protected async disconnect(): Promise<void> {
    const ch = this.ch;
    this.ch = null;
    if (ch && this.client) await this.client.removeChannel(ch);
  }

  protected async rawSend(frame: Frame): Promise<void> {
    const r = await this.ch?.send({ type: 'broadcast', event: 'msg', payload: frame });
    if (r !== undefined && r !== 'ok') throw new Error('supabase send failed: ' + r);
  }
}
