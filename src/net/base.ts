import type { Msg } from './messages.ts';
import { Session, type Frame } from './session.ts';
import type { JoinOptions, Role, Transport, TransportOptions } from './transport.ts';

const MAX_QUEUE = 100;

/** Common behaviour for concrete transports; subclasses supply the wire. */
export abstract class BaseTransport implements Transport {
  protected session = new Session();
  protected gen = 0;
  private ready = false;
  private queue: Msg[] = [];
  private out: Promise<unknown> = Promise.resolve();
  private msgCbs = new Set<(m: Msg) => void>();
  private presCbs = new Set<(s: string[]) => void>();
  private errCbs = new Set<(e: unknown) => void>();

  private readonly fixedSeat?: string;

  constructor(opts?: TransportOptions | string) {
    this.fixedSeat = typeof opts === 'string' ? opts : opts?.seat;
  }

  get seat(): string {
    return this.session.seat;
  }

  protected abstract connect(code: string, gen: number): Promise<void>;
  protected abstract disconnect(): Promise<void>;
  protected abstract rawSend(frame: Frame): Promise<void> | void;

  async join(code: string, role: Role, seat?: string, opts?: JoinOptions): Promise<void> {
    await this.leave();
    const gen = this.gen;
    await this.session.start(code, role, seat ?? this.fixedSeat, opts);
    if (gen !== this.gen) return;
    try {
      await this.connect(code, gen);
    } catch (e) {
      if (gen === this.gen) await this.leave();
      throw e;
    }
    if (gen !== this.gen) return;
    this.ready = true;
    const pending = this.queue;
    this.queue = [];
    for (const m of pending) this.dispatch(m);
  }

  send(m: Msg): void {
    if (!this.ready) {
      this.queue.push(m);
      if (this.queue.length > MAX_QUEUE) this.queue.shift();
      return;
    }
    this.dispatch(m);
  }

  private dispatch(m: Msg): void {
    const gen = this.gen;
    this.out = this.out
      .then(async () => {
        const frame = await this.session.encode(m);
        if (gen === this.gen) await this.rawSend(frame);
      })
      .catch((e) => this.emitError(e));
  }

  /** Called by subclasses for each inbound frame from the wire. */
  protected deliver(frame: unknown, gen: number): void {
    if (gen !== this.gen) return;
    void this.session.decode(frame).then((m) => {
      if (m && gen === this.gen) for (const cb of [...this.msgCbs]) cb(m);
    });
  }

  protected emitPresence(seats: string[]): void {
    for (const cb of [...this.presCbs]) cb(seats);
  }

  protected emitError(e: unknown): void {
    for (const cb of [...this.errCbs]) cb(e);
  }

  onMessage(cb: (m: Msg) => void): () => void {
    this.msgCbs.add(cb);
    return () => this.msgCbs.delete(cb);
  }

  onPresence(cb: (seats: string[]) => void): () => void {
    this.presCbs.add(cb);
    return () => this.presCbs.delete(cb);
  }

  onError(cb: (e: unknown) => void): () => void {
    this.errCbs.add(cb);
    return () => this.errCbs.delete(cb);
  }

  async leave(): Promise<void> {
    this.gen++;
    const wasReady = this.ready;
    this.ready = false;
    this.queue = [];
    try {
      await this.disconnect();
    } catch (e) {
      this.emitError(e);
    }
    if (wasReady) this.emitPresence([]);
  }

  hostPublicKey(): Promise<string> {
    return this.session.publicKey();
  }

  isHostVerified(): boolean {
    return this.session.verified;
  }
}
