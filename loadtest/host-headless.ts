/**
 * REFERENCE / FALLBACK host. Not the app host: a minimal, browserless implementation of
 * docs/rules.md over src/net + src/engine, so the harness can run without a UI.
 * Ground-truth logs (calls, pick arrival order, results, claims) are kept for the invariants.
 */
import {
  checkClaim,
  choicesFor,
  deckOrder,
  initialPickState,
  resolveWinners,
  scorePick,
  tabla,
} from '@engine';
import type { CardId, Category, PatternId } from '@engine';
import type { Msg } from '@net';
import type { Tx } from './transports.ts';

export interface HostOpts {
  code: string;
  tx: Tx;
  pool: { id: CardId; category: Category }[];
  pattern: PatternId;
  tickMs: number;
  maxCalls: number;
  seed?: string;
  /** accept picks this long after the next card is drawn */
  graceMs?: number;
}

export class HeadlessHost {
  seed: string;
  roundNo = 1;
  deck: CardId[];
  players = new Map<string, number>(); // seat -> tablaIndex
  state = initialPickState();
  calls: { i: number; cardId: CardId; choices: CardId[]; at: number }[] = [];
  pickLog: { seat: string; i: number; cardId: CardId; order: number; accepted: boolean }[] = [];
  results: { seat: string; i: number; correct: boolean; first: boolean }[] = [];
  claimLog: { seat: string; atCall: number; valid: boolean }[] = [];
  endMsg: { winners: string[]; exhausted: boolean } | null = null;
  expectedWinners: string[] = [];
  errors: string[] = [];
  private order = 0;
  private cur = -1;
  private curAt = 0;
  private window: { seat: string; points: number }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lobbyTimer: ReturnType<typeof setTimeout> | null = null;
  private done = false;
  private resolveDone!: () => void;
  finished = new Promise<void>((r) => (this.resolveDone = r));

  constructor(private o: HostOpts) {
    this.seed = o.seed ?? 'lt-' + Math.random().toString(36).slice(2, 10);
    this.deck = deckOrder(
      this.seed,
      this.roundNo,
      o.pool.map((c) => c.id),
    );
  }

  async start(): Promise<string> {
    const { tx } = this.o;
    tx.onMessage((m) => this.onMsg(m));
    tx.onError?.((e) => this.errors.push(String((e as Error)?.message ?? e)));
    await tx.join(this.o.code, 'host');
    return tx.hostPublicKey!();
  }

  private send(m: Msg): void {
    this.o.tx.send(m);
  }

  private onMsg(m: Msg): void {
    if (m.t === 'hello') {
      if (!this.players.has(m.seat)) this.players.set(m.seat, this.players.size);
      this.scheduleLobby();
    } else if (m.t === 'pick') this.onPick(m);
    else if (m.t === 'claim') this.onClaim(m);
  }

  /** Debounced: a naive per-hello lobby broadcast is O(N^2) frames in a join storm. */
  private scheduleLobby(): void {
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.send({
        t: 'lobby',
        status: this.cur >= 0 ? 'started' : 'waiting',
        players: [...this.players.keys()].map((seat) => ({
          seat,
          name: 'Bot ' + seat,
          glyph: '🫘',
        })),
      });
    }, 300);
  }

  /** Send round + assigns, then start the automatic caller. */
  begin(): void {
    this.send({
      t: 'round',
      seed: this.seed,
      roundNo: this.roundNo,
      mode: 'normal',
      pattern: this.o.pattern,
      callLang: 'es',
      speedSec: Math.max(3, this.o.tickMs / 1000),
      called: [],
    });
    for (const [seat, tablaIndex] of this.players)
      this.send({ t: 'assign', seat, tablaIndex, roundNo: this.roundNo });
    this.timer = setTimeout(() => this.tick(), 1000);
  }

  private tick(): void {
    if (this.done) return;
    this.resolveWindow();
    if (this.done) return;
    const i = this.cur + 1;
    if (i >= Math.min(this.o.maxCalls, this.deck.length)) return this.finish([], true);
    const cardId = this.deck[i] as CardId;
    const choices = choicesFor(this.seed, this.roundNo, i, cardId, this.o.pool);
    const at = Date.now();
    this.cur = i;
    this.curAt = at;
    this.calls.push({ i, cardId, choices, at });
    this.send({ t: 'call', i, cardId, choices, lang: 'es', at });
    this.timer = setTimeout(() => this.tick(), this.o.tickMs);
    // scores shortly after each call for the previous results
    if (i > 0) this.send({ t: 'scores', roundNo: this.roundNo, points: this.state.points });
  }

  private onPick(m: Extract<Msg, { t: 'pick' }>): void {
    const order = this.order++;
    const call = this.calls[m.i];
    const inWindow =
      !!call && m.i === this.cur
        ? true
        : !!call && m.i === this.cur - 1 && Date.now() - this.curAt < (this.o.graceMs ?? 400);
    if (!call || m.roundNo !== this.roundNo || !inWindow) {
      this.pickLog.push({ seat: m.seat, i: m.i, cardId: m.cardId, order, accepted: false });
      if (call)
        this.send({
          t: 'pickResult',
          roundNo: this.roundNo,
          i: m.i,
          seat: m.seat,
          correct: false,
          first: false,
        });
      return;
    }
    this.pickLog.push({ seat: m.seat, i: m.i, cardId: m.cardId, order, accepted: true });
    const r = scorePick(this.state, { seat: m.seat, i: m.i, cardId: m.cardId, at: order }, call);
    this.state = r.state;
    this.results.push(r.result);
    this.send({ t: 'pickResult', roundNo: this.roundNo, ...r.result });
  }

  private onClaim(m: Extract<Msg, { t: 'claim' }>): void {
    const idx = this.players.get(m.seat);
    if (idx === undefined || m.roundNo !== this.roundNo || this.done) return;
    const t = tabla(this.seed, idx, this.o.pool);
    const called = this.calls.map((c) => c.cardId);
    const r = checkClaim(t, called, this.o.pattern, this.state.crossed[m.seat] ?? []);
    this.claimLog.push({ seat: m.seat, atCall: this.cur, valid: r.valid });
    this.send({
      t: 'claimResult',
      seat: m.seat,
      roundNo: this.roundNo,
      valid: r.valid,
      missing: r.missing,
    });
    if (r.valid && !this.window.some((w) => w.seat === m.seat))
      this.window.push({ seat: m.seat, points: this.state.points[m.seat] ?? 0 });
  }

  /** Tie window closes when the next card would be drawn. */
  private resolveWindow(): void {
    if (this.window.length === 0) return;
    this.finish(resolveWinners(this.window), false);
  }

  private finish(winners: string[], exhausted: boolean): void {
    if (this.done) return;
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    this.expectedWinners = winners;
    this.endMsg = { winners, exhausted };
    this.send({ t: 'scores', roundNo: this.roundNo, points: this.state.points });
    this.send({ t: 'end', roundNo: this.roundNo, winners });
    setTimeout(() => this.resolveDone(), 1500);
  }

  stop(): Promise<void> {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    return this.o.tx.leave();
  }
}
