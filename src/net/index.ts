import { LocalTransport } from './local.ts';
import { SupabaseTransport } from './supabase.ts';
import type { Transport, TransportOptions } from './transport.ts';

export * from './messages.ts';
export * from './transport.ts';
export { LocalTransport } from './local.ts';
export { SupabaseTransport } from './supabase.ts';
export { generateHostKeyPair } from './crypto.ts';

export function createTransport(opts?: TransportOptions): Transport {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = ((import.meta as any).env ?? {}) as Record<string, unknown>;
    const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
    const key =
      typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
    if (url && key) return new SupabaseTransport(url, key, opts);
  } catch {
    /* fall through to local */
  }
  return new LocalTransport(opts);
}

export { PROTOCOL_VERSION } from './session.ts';
