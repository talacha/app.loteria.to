import { checkClaim, tabla } from '@engine';
import type { CardId, PatternId, Tabla } from '@engine';
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
  pattern: PatternId = 'line';
  tablaIndex = -1;
  tbl: Tabla | null = null;
  calls = new Map<number, CallRec>();
  dupCalls = 0;
  outOfOrder = 0;
  maxI = -1;
  callOrder = 0;
  crossed: CardId[] = [];
  /** cards that received a correct own pickResult */
  confirmed = new Set<CardId>();
  picks: { i: number; sentAt: number; resultAt?: number; correct?: boolean; wrong: boolean }[] = [];
  firstSeen = new Map<number, string[]>(); // i -> seats flagged first (every pickResult msg seen)
  firstMsgs = new Map<number, number>();
  scores: Record<string, number> = {};
  claims: { sentAt: number; resultAt?: number; valid?: boolean }[] = [];
  end: { winners: string[] } | null = null;
  errors: string[] = [];
  forgedSeen = 0;
  crossedWithoutResult = 0;
  private cardOf = new Map<number, { cardId: CardId; choices: CardId[] }>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private pool = cardPool();
  private claimTimer: ReturnType<typeof setInterval> | null = null;
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
    // Hello is not persisted by Realtime: resend until assigned.
    const iv = setInterval(() => (this.assigned ? clearInterval(iv) : hello()), 2000);
    (iv as { unref?: () => void }).unref?.();
  }

  stop(): Promise<void> {
    for (const t of this.timers) clearTimeout(t);
    if (this.claimTimer) clearInterval(this.claimTimer);
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
    // Forged markers injected by the adversary (run.ts) must never surface.
    if (('roundNo' in m && m.roundNo === 777) || (m.t === 'call' && m.i >= 900)) this.forgedSeen++;
    switch (m.t) {
      case 'round':
        this.seed = m.seed;
        this.roundNo = m.roundNo;
        this.pattern = m.pattern;
        this.mk();
        break;
      case 'assign':
        if (m.seat === this.seat) {
          this.tablaIndex = m.tablaIndex;
          this.assigned = true;
          this.mk();
        }
        break;
      case 'call':
        this.onCall(m, now);
        break;
      case 'pickResult':
        this.onResult(m, now);
        break;
      case 'scores':
        this.scores = m.points;
        break;
      case 'claimResult':
        if (m.seat === this.seat) {
          const c = this.claims[this.claims.length - 1];
          if (c && c.resultAt === undefined) {
            c.resultAt = now;
            c.valid = m.valid;
          }
        }
        break;
      case 'end':
        this.end = { winners: m.winners };
        break;
      default:
        break;
    }
  }

  private mk(): void {
    if (this.seed && this.tablaIndex >= 0 && !this.tbl)
      this.tbl = tabla(this.seed, this.tablaIndex, this.pool);
  }

  private onCall(m: Extract<Msg, { t: 'call' }>, now: number): void {
    if (this.calls.has(m.i)) {
      this.dupCalls++;
      return;
    }
    if (m.i < this.maxI) this.outOfOrder++;
    this.maxI = Math.max(this.maxI, m.i);
    this.calls.set(m.i, { i: m.i, at: m.at, recvAt: now, order: this.callOrder++ });
    this.cardOf.set(m.i, { cardId: m.cardId, choices: m.choices });
    this.mk();
    if (!this.tbl || !this.tbl.cards.includes(m.cardId)) return; // "No está en tu tabla"
    const delay = this.o.mode === 'race' ? 0 : rand(this.o.delayMin, this.o.delayMax);
    const wrong = Math.random() < this.o.wrongRate;
    this.later(delay, () => {
      if (this.end) return;
      if (wrong) {
        const bad = m.choices.find((c) => c !== m.cardId) as CardId;
        this.pick(m.i, bad, true);
        this.later(this.o.retryMs ?? 450, () => !this.end && this.pick(m.i, m.cardId, false));
      } else this.pick(m.i, m.cardId, false);
    });
  }

  private pick(i: number, cardId: CardId, wrong: boolean): void {
    this.picks.push({ i, sentAt: Date.now(), wrong });
    this.o.tx.send({ t: 'pick', seat: this.seat, roundNo: this.roundNo, i, cardId });
  }

  private onResult(m: Extract<Msg, { t: 'pickResult' }>, now: number): void {
    if (m.first) {
      this.firstMsgs.set(m.i, (this.firstMsgs.get(m.i) ?? 0) + 1);
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
    if (!m.correct) return;
    const c = this.cardOf.get(m.i)?.cardId;
    if (!c) {
      this.crossedWithoutResult++;
      return;
    }
    this.confirmed.add(c);
    if (!this.crossed.includes(c)) this.crossed.push(c);
    this.maybeClaim();
  }

  private maybeClaim(): void {
    if (!this.tbl || this.end || this.claimTimer) return;
    const r = checkClaim(this.tbl, this.crossed, this.pattern, this.crossed);
    if (!r.valid) return;
    const send = () => {
      if (this.end) return this.claimTimer && clearInterval(this.claimTimer);
      const last = this.claims[this.claims.length - 1];
      if (last?.resultAt !== undefined) return this.claimTimer && clearInterval(this.claimTimer);
      this.claims.push({ sentAt: Date.now() });
      this.o.tx.send({
        t: 'claim',
        seat: this.seat,
        roundNo: this.roundNo,
        tablaIndex: this.tablaIndex,
        marks: [...this.crossed],
      });
    };
    send();
    // Claims are rate-limited (3 s per seat); retry if the host never answers.
    this.claimTimer = setInterval(send, 3200);
    (this.claimTimer as { unref?: () => void }).unref?.();
  }
}
