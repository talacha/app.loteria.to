import { generateHostKeys, signMsg, verifyMsg, type HostKeys } from './crypto.ts';
import { HOST_ONLY, parseMsg, type Msg } from './messages.ts';
import {
  CLAIM_INTERVAL_MS,
  MAX_CLAIMS_PER_SEC,
  getSeat,
  type JoinOptions,
  type Role,
} from './transport.ts';

export interface Frame {
  role: Role;
  from: string;
  m: unknown;
  sig?: string;
}

/** Shared protocol state: seat, host keys, signing, receive-side policy. */
export class Session {
  role: Role = 'player';
  seat = '';
  verified = false;
  private keys: HostKeys | null = null;
  private pinned: string | null = null;
  private lastClaim = new Map<string, number>();
  private recent: number[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async start(code: string, role: Role, opts?: JoinOptions, fixedSeat?: string): Promise<void> {
    this.role = role;
    this.seat = fixedSeat ?? getSeat(code, role);
    this.keys = role === 'host' ? await generateHostKeys() : null;
    this.pinned = role === 'player' ? (opts?.hostKey ?? null) : null;
    this.verified = role === 'player' && !!opts?.hostKey;
    this.lastClaim.clear();
    this.recent = [];
  }

  async publicKey(): Promise<string> {
    if (!this.keys) throw new Error('hostPublicKey is only available to the host');
    return this.keys.pub;
  }

  /** Validate and sign an outgoing message. Throws on invalid input. */
  async encode(input: Msg): Promise<Frame> {
    let m = parseMsg(input);
    if (!m) throw new Error('invalid message');
    if (HOST_ONLY.has(m.t)) {
      if (!this.keys) throw new Error('only the host may send ' + m.t);
      if (m.t === 'round') m = { ...m, hostKey: this.keys.pub };
      return { role: this.role, from: this.seat, m, sig: await signMsg(this.keys.priv, m) };
    }
    return { role: this.role, from: this.seat, m };
  }

  /** Apply receive policy. Calls are serialised so async verification keeps order. */
  decode(frame: unknown): Promise<Msg | null> {
    const run = this.chain.then(() => this.check(frame)).catch(() => null);
    this.chain = run;
    return run;
  }

  private async check(frame: unknown): Promise<Msg | null> {
    if (!frame || typeof frame !== 'object') return null;
    const f = frame as Partial<Frame>;
    if (f.role !== 'host' && f.role !== 'player') return null;
    if (typeof f.from !== 'string' || !f.from || f.from.length > 64) return null;
    const m = parseMsg(f.m);
    if (!m) return null;

    if (HOST_ONLY.has(m.t)) {
      if (this.role === 'host' || f.role !== 'host' || typeof f.sig !== 'string') return null;
      let key = this.pinned;
      if (!key) {
        if (m.t !== 'round' || !m.hostKey) return null;
        key = m.hostKey;
      }
      if (!(await verifyMsg(key, f.sig, m))) return null;
      this.pinned = key;
      return m;
    }

    // client -> host messages
    if (this.role !== 'host' || f.role !== 'player') return null;
    if (!('seat' in m) || m.seat !== f.from) return null;
    if (m.t === 'claim' && !this.allowClaim(f.from)) return null;
    return m;
  }

  private allowClaim(from: string): boolean {
    const t = this.now();
    for (const [k, v] of this.lastClaim) if (t - v >= CLAIM_INTERVAL_MS) this.lastClaim.delete(k);
    this.recent = this.recent.filter((x) => t - x < 1000);
    if (this.recent.length >= MAX_CLAIMS_PER_SEC) return false;
    if (this.lastClaim.has(from)) return false;
    this.lastClaim.set(from, t);
    this.recent.push(t);
    return true;
  }
}
