/** Reference host using the current assign/pick/callClosed/full-card protocol, without a UI. */
import {
  ROOM_MAX_PLAYERS,
  choicesFor,
  crossedAfterCall,
  deckOrder,
  initialPickState,
  isCardComplete,
  pickTablaIndex,
  resolveFullCardWinners,
  scorePick,
  tabla,
} from '@engine';
import type { CardId, Category, PickResult } from '@engine';
import type { Msg } from '@net';
import type { Tx } from './transports.ts';

export interface HostOpts {
  code: string;
  tx: Tx;
  pool: { id: CardId; category: Category }[];
  tickMs: number;
  maxCalls: number;
  seed?: string;
}

export class HeadlessHost {
  seed: string;
  roundNo = 1;
  deck: CardId[];
  players = new Map<string, number>();
  state = initialPickState();
  calls: { i: number; cardId: CardId; choices: [CardId, CardId, CardId]; at: number }[] = [];
  closed: CardId[] = [];
  pickLog: { seat: string; i: number; cardId: CardId; order: number; accepted: boolean }[] = [];
  results: PickResult[] = [];
  endMsg: { winners: string[]; reason: 'full-card' } | null = null;
  expectedWinners: string[] = [];
  errors: string[] = [];
  private order = 0;
  private cur = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lobbyTimer: ReturnType<typeof setTimeout> | null = null;
  private scoresTimer: ReturnType<typeof setTimeout> | null = null;
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
      if (!this.players.has(m.seat)) {
        if (this.players.size >= ROOM_MAX_PLAYERS) {
          this.sendLobby('full');
          return;
        }
        this.players.set(
          m.seat,
          pickTablaIndex(this.seed, [...this.players.values()], this.o.pool),
        );
      }
      this.scheduleLobby();
      if (this.cur >= 0 && !this.done) {
        this.sendRound();
        this.sendAssign(m.seat, this.players.get(m.seat)!);
        const call = this.calls[this.cur]!;
        this.send({ t: 'call', ...call });
      }
    } else if (m.t === 'pick') this.onPick(m);
  }

  private sendLobby(status: 'waiting' | 'started' | 'full'): void {
    this.send({
      t: 'lobby',
      status,
      roundNo: this.roundNo,
      players: [...this.players.keys()].map((seat) => ({ seat, name: 'Bot ' + seat, glyph: '🫘' })),
    });
  }

  private scheduleLobby(): void {
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.sendLobby(this.cur >= 0 ? 'started' : 'waiting');
    }, 300);
  }

  private sendRound(): void {
    this.send({
      t: 'round',
      seed: this.seed,
      roundNo: this.roundNo,
      speedSec: Math.max(3, this.o.tickMs / 1000),
      gridSize: 4,
    });
  }

  private sendAssign(seat: string, tablaIndex: number): void {
    this.send({ t: 'assign', seat, tablaIndex, roundNo: this.roundNo, closed: [...this.closed] });
  }

  begin(): void {
    this.sendLobby('started');
    this.sendRound();
    for (const [seat, tablaIndex] of this.players) this.sendAssign(seat, tablaIndex);
    this.timer = setTimeout(() => this.tick(), 1000);
  }

  private sendScores(): void {
    if (this.scoresTimer) clearTimeout(this.scoresTimer);
    this.scoresTimer = null;
    this.send({
      t: 'scores',
      roundNo: this.roundNo,
      points: { ...this.state.points },
      crossed: Object.fromEntries(
        [...this.players].map(([seat, idx]) => [
          seat,
          crossedAfterCall(tabla(this.seed, idx, this.o.pool), this.closed).length,
        ]),
      ),
    });
  }

  private tick(): void {
    if (this.done) return;
    if (this.cur >= 0) {
      this.closed.push(this.calls[this.cur]!.cardId);
      this.send({ t: 'callClosed', roundNo: this.roundNo, i: this.cur });
      this.sendScores();
      const completed = [...this.players]
        .filter(([, idx]) => {
          const board = tabla(this.seed, idx, this.o.pool);
          return isCardComplete(board, crossedAfterCall(board, this.closed));
        })
        .map(([seat]) => seat);
      if (completed.length)
        return this.finish(resolveFullCardWinners(completed, this.state.points));
    }
    const i = this.cur + 1;
    if (i >= Math.min(this.o.maxCalls, this.deck.length)) {
      this.done = true;
      this.resolveDone(); // A truncated harness run must fail the missing-end invariant.
      return;
    }
    const cardId = this.deck[i] as CardId;
    const choices = choicesFor(this.seed, this.roundNo, i, cardId, this.o.pool);
    const at = Date.now();
    this.cur = i;
    this.calls.push({ i, cardId, choices, at });
    this.send({ t: 'call', i, cardId, choices, at });
    this.timer = setTimeout(() => this.tick(), this.o.tickMs);
  }

  private onPick(m: Extract<Msg, { t: 'pick' }>): void {
    const order = this.order++;
    const call = this.calls[m.i];
    const accepted =
      !this.done &&
      !!call &&
      m.i === this.cur &&
      m.roundNo === this.roundNo &&
      this.players.has(m.seat);
    this.pickLog.push({ seat: m.seat, i: m.i, cardId: m.cardId, order, accepted });
    if (!accepted || !call) return;
    const r = scorePick(this.state, { seat: m.seat, i: m.i, cardId: m.cardId, at: order }, call);
    this.state = r.state;
    this.results.push(r.result);
    this.send({ t: 'pickResult', roundNo: this.roundNo, ...r.result });
    if (r.result.correct && r.result.first) this.sendScores();
    else if (r.result.correct && !this.scoresTimer)
      this.scoresTimer = setTimeout(() => this.sendScores(), 500);
  }

  private finish(winners: string[]): void {
    this.done = true;
    this.expectedWinners = winners;
    this.endMsg = { winners, reason: 'full-card' };
    this.send({ t: 'end', roundNo: this.roundNo, winners, reason: 'full-card' });
    this.resolveDone();
  }

  stop(): Promise<void> {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    if (this.scoresTimer) clearTimeout(this.scoresTimer);
    return this.o.tx.leave();
  }
}
