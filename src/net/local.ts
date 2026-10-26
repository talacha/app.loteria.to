import { BaseTransport } from './base.ts';
import type { Frame } from './session.ts';
import type { Role } from './transport.ts';

export const HEARTBEAT_MS = 2000;
export const PRESENCE_EXPIRY_MS = 6000;

type Wire =
  { k: 'msg'; frame: Frame } | { k: 'presence'; seat: string; role: Role; leave?: boolean };

export class LocalTransport extends BaseTransport {
  private ch: BroadcastChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seen = new Map<string, { t: number; role: Role }>();
  private lastPresence = '';

  protected async connect(code: string, gen: number): Promise<void> {
    const ch = new BroadcastChannel('loteria:' + code);
    this.ch = ch;
    ch.onmessage = (e: MessageEvent) => this.onWire(e.data as Wire, gen);
    this.beat();
    this.timer = setInterval(() => this.beat(), HEARTBEAT_MS);
    (this.timer as { unref?: () => void }).unref?.();
  }

  protected async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ch) {
      const w: Wire = {
        k: 'presence',
        seat: this.session.seat,
        role: this.session.role,
        leave: true,
      };
      this.ch.postMessage(w);
      this.ch.close();
    }
    this.ch = null;
    this.seen.clear();
    this.lastPresence = '';
  }

  protected rawSend(frame: Frame): void {
    this.ch?.postMessage({ k: 'msg', frame } satisfies Wire);
  }

  private beat(): void {
    const w: Wire = { k: 'presence', seat: this.session.seat, role: this.session.role };
    this.ch?.postMessage(w);
    this.seen.set(this.session.seat, { t: Date.now(), role: this.session.role });
    this.refresh();
  }

  private onWire(w: Wire, gen: number): void {
    if (!w || typeof w !== 'object') return;
    if (w.k === 'msg') {
      this.deliver(w.frame, gen);
    } else if (w.k === 'presence') {
      if (typeof w.seat !== 'string' || !w.seat || w.seat.length > 64) return;
      if (w.role !== 'host' && w.role !== 'player') return;
      if (w.leave) this.seen.delete(w.seat);
      else {
        const isNew = !this.seen.has(w.seat);
        this.seen.set(w.seat, { t: Date.now(), role: w.role });
        if (isNew) {
          const mine: Wire = { k: 'presence', seat: this.session.seat, role: this.session.role };
          this.ch?.postMessage(mine);
        }
      }
      this.refresh();
    }
  }

  private refresh(): void {
    const now = Date.now();
    for (const [s, v] of this.seen) if (now - v.t > PRESENCE_EXPIRY_MS) this.seen.delete(s);
    const seats = [...this.seen.entries()]
      .filter(([, v]) => v.role === 'player')
      .map(([s]) => s)
      .sort();
    const key = seats.join(',');
    if (key === this.lastPresence) return;
    this.lastPresence = key;
    this.emitPresence(seats);
  }
}
