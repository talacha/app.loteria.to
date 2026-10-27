/// <reference lib="webworker" />
import { buildBoardsPdf } from './build';
import { printArt } from './cards';
import { renderPrintArt, type PrintImage } from './illustrations';
import type { PrintOptions } from './layout';

export interface WorkerRequest {
  opts: PrintOptions;
  /** Absolute URL of the Noto Sans TTF. */
  fontUrl?: string;
  /** Pictures prepared by the main thread when the worker has no canvas. */
  images?: Record<string, PrintImage>;
}
export type WorkerResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; bytes: Uint8Array; degraded: boolean }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const { opts, fontUrl, images: providedImages } = e.data;
    let fontBytes = opts.fontBytes ?? null;
    if (!fontBytes && fontUrl) {
      try {
        const res = await fetch(fontUrl);
        if (res.ok) fontBytes = new Uint8Array(await res.arrayBuffer());
      } catch {
        /* Helvetica fallback */
      }
    }
    const images = providedImages
      ? new Map(Object.entries(providedImages))
      : await renderPrintArt(printArt(opts));
    const { bytes, degraded } = await buildBoardsPdf(opts, {
      emoji: null,
      images,
      fontBytes,
      onProgress: (done, total) =>
        ctx.postMessage({ type: 'progress', done, total } satisfies WorkerResponse),
    });
    ctx.postMessage({ type: 'done', bytes, degraded } satisfies WorkerResponse, [bytes.buffer]);
  } catch (err) {
    ctx.postMessage({ type: 'error', message: String(err) } satisfies WorkerResponse);
  }
};
