import { LocalTransport, SupabaseTransport } from '@net';
import type { Transport } from '@net';
import type { Wire } from './common.ts';

export type Kind = 'local' | 'supabase';
export interface Net {
  kind: Kind;
  url?: string;
  key?: string;
}
export type Tx = Transport & {
  /** Put a raw frame on the wire, bypassing Session.encode (adversary use). */
  inject(frame: unknown): Promise<void> | void;
  frames: unknown[];
};

/**
 * Real transports with their protected hooks tapped on the instance:
 * deliver() sees every raw inbound frame before policy; rawSend() every signed outbound frame.
 */
export function makeTransport(net: Net, seat: string, wire: Wire, keep = false): Tx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- both transports share the Tx surface
  const t: any =
    net.kind === 'supabase'
      ? new SupabaseTransport(net.url as string, net.key as string, { seat })
      : new LocalTransport({ seat });
  t.frames = [];
  const origDeliver = t.deliver.bind(t);
  t.deliver = (frame: unknown, gen: number) => {
    wire.onRx();
    if (keep) t.frames.push(frame);
    origDeliver(frame, gen);
  };
  const origRaw = t.rawSend.bind(t);
  t.rawSend = (frame: unknown) => {
    wire.onTx(frame);
    return origRaw(frame);
  };
  t.inject = (frame: unknown) => origRaw(frame);
  return t as Tx;
}
