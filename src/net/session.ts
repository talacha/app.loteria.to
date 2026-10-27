import { generateHostKeys, signMsg, verifyMsg, type HostKeys } from './crypto.ts';
import { HOST_ONLY, parseMsg, type Msg } from './messages.ts';
import { SequenceStorageError, sequenceStore, type SequenceStore } from './sequence.ts';
import {
  PICK_INTERVAL_MS,
  MAX_PICKS_PER_CALL,
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
  v?: number;
  seq?: number;
}

export class ProtocolVersionError extends Error {
  constructor() {
    super(
      'Incompatible room protocol. Refresh the organiser and every player to the latest version.',
    );
    this.name = 'ProtocolVersionError';
  }
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
  private lastPick = new Map<string, { n: number; t: number }>();
  private lastPickAt = new Map<string, number>();
  private chain: Promise<unknown> = Promise.resolve();
  private outgoing: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly sequences: SequenceStore = sequenceStore(),
  ) {}

  async start(code: string, role: Role, opts?: JoinOptions, fixedSeat?: string): Promise<void> {
    this.role = role;
    this.seat = fixedSeat ?? getSeat(code, role);
    this.keys = role === 'host' ? await generateHostKeys(opts?.keyPair) : null;
    this.pinned = role === 'player' ? (opts?.hostKey ?? null) : null;
    this.verified = role === 'player' && !!opts?.hostKey;
    this.lastClaim.clear();
    this.lastPick.clear();
    this.lastPickAt.clear();
    this.recent = [];
  }

  async publicKey(): Promise<string> {
    if (!this.keys) throw new Error('hostPublicKey is only available to the host');
    return this.keys.pub;
  }

  /** Validate and sign an outgoing message. Throws on invalid input. */
  encode(input: Msg): Promise<Frame> {
    const run = this.outgoing.then(() => this.encodeNext(input));
    this.outgoing = run.catch(() => undefined);
    return run;
  }

  private async encodeNext(input: Msg): Promise<Frame> {
    let m = parseMsg(input);
    if (!m) throw new Error('invalid message');
    if (HOST_ONLY.has(m.t)) {
      if (!this.keys) throw new Error('only the host may send ' + m.t);
      if (m.t === 'round' || m.t === 'lobby') m = { ...m, hostKey: this.keys.pub };
      const seq = await this.sequences.next('tx:' + this.keys.pub);
      const envelope = { v: 2, seq, m };
      return {
        role: this.role,
        from: this.seat,
        ...envelope,
        sig: await signMsg(this.keys.priv, envelope),
      };
    }
    return { role: this.role, from: this.seat, m };
  }

  /** Apply receive policy. Calls are serialised so async verification keeps order. */
  decode(frame: unknown): Promise<Msg | null> {
    const run = this.chain
      .then(() => this.check(frame))
      .catch((error: unknown) => {
        if (error instanceof ProtocolVersionError || error instanceof SequenceStorageError)
          throw error;
        return null;
      });
    this.chain = run.catch(() => undefined);
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
        if ((m.t !== 'round' && m.t !== 'lobby') || !m.hostKey) return null;
        key = m.hostKey;
      }
      if (f.v !== 2) {
        // Only an authenticated old host can raise a compatibility error. Forgery stays silent.
        const authenticated = await verifyMsg(
          key,
          f.sig,
          f.v === undefined ? m : { v: f.v, seq: f.seq, m },
        );
        if (authenticated) throw new ProtocolVersionError();
        return null;
      }
      if (!Number.isSafeInteger(f.seq) || (f.seq as number) < 1) return null;
      if (!(await verifyMsg(key, f.sig, { v: 2, seq: f.seq, m }))) return null;
      // Write before delivery so a reload cannot accept a frame already shown to this seat.
      if (!(await this.sequences.accept(`rx:${key}:${this.seat}`, f.seq as number))) return null;
      this.pinned = key;
      return m;
    }

    // client -> host messages
    if (this.role !== 'host' || f.role !== 'player') return null;
    if (!('seat' in m) || m.seat !== f.from) return null;
    if (m.t === 'claim' && !this.allowClaim(f.from)) return null;
    if (m.t === 'pick' && !this.allowPick(f.from, m.roundNo, m.i)) return null;
    return m;
  }

  private allowPick(from: string, roundNo: number, i: number): boolean {
    const t = this.now();
    for (const [k, v] of this.lastPick) if (t - v.t >= 60_000) this.lastPick.delete(k);
    const last = this.lastPickAt.get(from);
    if (last !== undefined && t - last < PICK_INTERVAL_MS) return false;
    const key = `${from}:${roundNo}:${i}`;
    const n = this.lastPick.get(key)?.n ?? 0;
    if (n >= MAX_PICKS_PER_CALL) return false;
    this.lastPick.set(key, { n: n + 1, t });
    this.lastPickAt.set(from, t);
    if (this.lastPickAt.size > 500) {
      for (const [k, v] of this.lastPickAt)
        if (t - v >= PICK_INTERVAL_MS) this.lastPickAt.delete(k);
    }
    return true;
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
