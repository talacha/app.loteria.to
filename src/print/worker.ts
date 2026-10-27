/// <reference lib="webworker" />
import { cards } from '@content';
import { buildBoardsPdf } from './build';
import { renderEmojiPngs } from './emoji';
import type { PrintOptions } from './layout';

export interface WorkerRequest {
  opts: PrintOptions;
  /** Absolute URL of the Noto Sans TTF. */
  fontUrl?: string;
  /** Pre-rendered emoji PNGs from the main thread, when the worker has no canvas. */
  emoji?: Record<string, Uint8Array>;
}
export type WorkerResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; bytes: Uint8Array; degraded: boolean }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const { opts, fontUrl, emoji } = e.data;
    let fontBytes = opts.fontBytes ?? null;
    if (!fontBytes && fontUrl) {
      try {
        const res = await fetch(fontUrl);
        if (res.ok) fontBytes = new Uint8Array(await res.arrayBuffer());
      } catch {
        /* Helvetica fallback */
      }
    }
    const png = emoji
      ? new Map(Object.entries(emoji))
      : await renderEmojiPngs(cards.map((c) => ({ id: c.id, art: c.art })));
    const { bytes, degraded } = await buildBoardsPdf(opts, {
      emoji: png,
      fontBytes,
      onProgress: (done, total) =>
        ctx.postMessage({ type: 'progress', done, total } satisfies WorkerResponse),
    });
    ctx.postMessage({ type: 'done', bytes, degraded } satisfies WorkerResponse, [bytes.buffer]);
  } catch (err) {
    ctx.postMessage({ type: 'error', message: String(err) } satisfies WorkerResponse);
  }
};
