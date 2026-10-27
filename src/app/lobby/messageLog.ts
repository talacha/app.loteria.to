import type { Msg } from '@net';

/** Append-only buffer of game messages, so the game screen can replay what arrived in the lobby. */
export class MessageLog {
  readonly items: Msg[] = [];
  private subs = new Set<() => void>();

  push(m: Msg): void {
    if (this.items.length >= 3000) return;
    this.items.push(m);
    for (const cb of [...this.subs]) cb();
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
}
