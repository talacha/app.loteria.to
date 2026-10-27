import { tabla } from '@engine';
import type { CardId, Tabla } from '@engine';
import type { Msg } from '@net';
import { cardPool, rand } from './common.ts';
import type { Tx } from './transports.ts';

export interface BotOpts {
  seat: string;
  code: string;
  hostKey: string;
  tx: Tx;
  mode: 'normal' | 'race';
  delayMin: number;
  delayMax: number;
  wrongRate: number;
  /** ms between a wrong pick and the retry (must exceed PICK_INTERVAL_MS=400). */
  retryMs?: number;
}

export interface CallRec {
  i: number;
  cardId: CardId;
  at: number;
  recvAt: number;
  order: number;
}

/** Headless player using the real transport + engine. All timestamps are Date.now() ms. */
export class Bot {
  seat: string;
  name: string;
  seed = '';
  roundNo = -1;
  gridSize = 4;
  tablaIndex = -1;
  tbl: Tabla | null = null;
  calls = new Map<number, CallRec>();
  closed = new Set<number>();
  dupCalls = 0;
  outOfOrder = 0;
  maxI = -1;
  callOrder = 0;
  crossed: CardId[] = [];
  picks: { i: number; sentAt: number; resultAt?: number; correct?: boolean; wrong: boolean }[] = [];
  firstSeen = new Map<number, string[]>();
  scores: Record<string, number> = {};
  crossedCounts: Record<string, number> = {};
  end: { winners: string[]; reason: string } | null = null;
  errors: string[] = [];
  forgedSeen = 0;
  private assignmentRound = -1;
  private history: CardId[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  private pool = cardPool();
  assigned = false;

  constructor(private o: BotOpts) {
    this.seat = o.seat;
    this.name = 'Bot ' + o.seat;
  }

  async start(): Promise<void> {
    const { tx } = this.o;
    tx.onMessage((m) => this.onMsg(m));
    tx.onError?.((e) => this.errors.push(String((e as Error)?.message ?? e)));
    await tx.join(this.o.code, 'player', { hostKey: this.o.hostKey });
    const hello = () =>
      tx.send({ t: 'hello', seat: this.seat, name: this.name, glyph: '🫘', labelLang: 'es' });
    hello();
    this.helloTimer = setInterval(() => {
      if (this.assigned) {
        if (this.helloTimer) clearInterval(this.helloTimer);
        this.helloTimer = null;
      } else hello();
    }, 2000);
  }

  stop(): Promise<void> {
    for (const t of this.timers) clearTimeout(t);
    if (this.helloTimer) clearInterval(this.helloTimer);
    return this.o.tx.leave();
  }

  private later(ms: number, f: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      f();
    }, ms);
    this.timers.add(t);
  }

  private onMsg(m: Msg): void {
    const now = Date.now();
    if (('roundNo' in m && m.roundNo === 777) || (m.t === 'call' && m.i >= 900)) this.forgedSeen++;
    if ('roundNo' in m && m.t !== 'round' && m.t !== 'assign' && m.roundNo !== this.roundNo) return;
    switch (m.t) {
      case 'round': {
        const changed = this.seed !== m.seed || this.roundNo !== m.roundNo;
        if (changed) {
          for (const t of this.timers) clearTimeout(t);
          this.timers.clear();
          this.calls.clear();
          this.closed.clear();
          this.picks = [];
          this.firstSeen.clear();
          this.crossed = [];
          this.scores = {};
          this.end = null;
          this.maxI = -1;
          this.callOrder = 0;
          if (this.assignmentRound !== m.roundNo) this.history = [];
        }
        if (changed || this.gridSize !== (m.gridSize ?? 4)) this.tbl = null;
        this.seed = m.seed;
        this.roundNo = m.roundNo;
        this.gridSize = m.gridSize ?? 4;
        this.mk();
        break;
      }
      case 'assign':
        if (m.seat === this.seat) {
          if (m.roundNo < this.roundNo) return;
          if (this.tablaIndex !== m.tablaIndex || this.assignmentRound !== m.roundNo)
            this.tbl = null;
          this.tablaIndex = m.tablaIndex;
          this.assignmentRound = m.roundNo;
          // Optional closed history restores late joiners/reloaded players; older hosts omit it.
          if ('closed' in m && Array.isArray(m.closed)) this.history = m.closed as CardId[];
          this.mk();
        }
        break;
      case 'call':
        this.onCall(m, now);
        break;
      case 'callClosed':
        this.closeCall(m.i);
        break;
      case 'pickResult':
        this.onResult(m, now);
        break;
      case 'scores':
        this.scores = m.points;
        this.crossedCounts = m.crossed ?? {};
        break;
      case 'end':
        this.end = { winners: m.winners, reason: m.reason };
        break;
      default:
        break;
    }
  }

  private mk(): void {
    this.assigned = !!this.seed && this.tablaIndex >= 0 && this.assignmentRound === this.roundNo;
    if (!this.assigned) return;
    this.tbl ??= tabla(this.seed, this.tablaIndex, this.pool, this.gridSize);
    const called = new Set([
      ...this.history,
      ...[...this.closed].flatMap((i) => this.calls.get(i)?.cardId ?? []),
    ]);
    this.crossed = this.tbl.cards.filter((c) => called.has(c));
  }

  private closeCall(i: number): void {
    this.closed.add(i);
    this.mk();
  }

  private onCall(m: Extract<Msg, { t: 'call' }>, now: number): void {
    if (this.calls.has(m.i)) {
      this.dupCalls++;
      return;
    }
    if (m.i < this.maxI) this.outOfOrder++;
    if (m.i > this.maxI && this.maxI >= 0) this.closeCall(this.maxI);
    this.maxI = Math.max(this.maxI, m.i);
    this.calls.set(m.i, {
      i: m.i,
      cardId: m.cardId,
      at: m.at,
      recvAt: now,
      order: this.callOrder++,
    });
    this.mk();
    if (!this.tbl) return;
    const roundNo = this.roundNo;
    const delay = this.o.mode === 'race' ? 0 : rand(this.o.delayMin, this.o.delayMax);
    const wrong = Math.random() < this.o.wrongRate;
    this.later(delay, () => {
      if (wrong) {
        const bad = m.choices.find((c) => c !== m.cardId) as CardId;
        this.pick(roundNo, m.i, bad, true);
        this.later(this.o.retryMs ?? 450, () => this.pick(roundNo, m.i, m.cardId, false));
      } else this.pick(roundNo, m.i, m.cardId, false);
    });
  }

  private pick(roundNo: number, i: number, cardId: CardId, wrong: boolean): void {
    if (this.end || roundNo !== this.roundNo || i !== this.maxI || this.closed.has(i)) return;
    this.picks.push({ i, sentAt: Date.now(), wrong });
    this.o.tx.send({ t: 'pick', seat: this.seat, roundNo, i, cardId });
  }

  private onResult(m: Extract<Msg, { t: 'pickResult' }>, now: number): void {
    if (m.first) {
      const l = this.firstSeen.get(m.i) ?? [];
      if (!l.includes(m.seat)) l.push(m.seat);
      this.firstSeen.set(m.i, l);
    }
    if (m.seat !== this.seat) return;
    const p = this.picks.find((x) => x.i === m.i && x.resultAt === undefined);
    if (p) {
      p.resultAt = now;
      p.correct = m.correct;
    }
  }
}
