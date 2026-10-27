// Import-light entry: pdf-lib, fontkit and the builder load lazily inside generateBoardsPdf.
import { canvasAvailable, renderEmojiPngs } from './emoji';
import type { PrintOptions } from './layout';
import type { WorkerRequest, WorkerResponse } from './worker';

export * from './options';

export interface PdfResult {
  bytes: Uint8Array;
  /** Fallback font in use and some labels lost characters. */
  degraded: boolean;
}
export interface GenerateHooks {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

function fontUrl(): string | undefined {
  if (typeof location === 'undefined') return undefined;
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return new URL(`${base}fonts/NotoSans-Regular.ttf`, location.origin).href;
}

async function loadCardArt(): Promise<{ id: string; art: string }[]> {
  const { cards } = await import('@content');
  return cards.map((c) => ({ id: c.id, art: c.art }));
}

function aborted(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
}

async function onMainThread(opts: PrintOptions, hooks: GenerateHooks): Promise<PdfResult> {
  const { buildBoardsPdf } = await import('./build');
  const art = await loadCardArt();
  const emoji = canvasAvailable() ? await renderEmojiPngs(art) : null;
  let fontBytes: Uint8Array | null = opts.fontBytes ?? null;
  const url = fontUrl();
  if (!fontBytes && url) {
    try {
      const res = await fetch(url, { signal: hooks.signal });
      if (res.ok) fontBytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      if (hooks.signal?.aborted) throw aborted(hooks.signal);
    }
  }
  return buildBoardsPdf(opts, {
    emoji,
    fontBytes,
    onProgress: hooks.onProgress,
    signal: hooks.signal,
  });
}

async function inWorker(opts: PrintOptions, hooks: GenerateHooks): Promise<PdfResult> {
  const req: WorkerRequest = { opts, fontUrl: fontUrl() };
  if (typeof OffscreenCanvas === 'undefined' && canvasAvailable()) {
    req.emoji = Object.fromEntries(await renderEmojiPngs(await loadCardArt()));
  }
  const { signal } = hooks;
  if (signal?.aborted) throw aborted(signal);
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return new Promise<PdfResult>((resolve, reject) => {
    const onAbort = () => {
      worker.terminate();
      reject(aborted(signal as AbortSignal));
    };
    const finish = () => signal?.removeEventListener('abort', onAbort);
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.type === 'progress') {
        hooks.onProgress?.(m.done, m.total);
        return;
      }
      finish();
      worker.terminate();
      if (m.type === 'done') resolve({ bytes: m.bytes, degraded: m.degraded });
      else reject(new Error(m.message));
    };
    worker.onerror = (e) => {
      finish();
      worker.terminate();
      reject(new Error(e.message || 'worker failed'));
    };
    worker.postMessage(req);
  });
}

/**
 * Build the PDF of boards (cantor sheet first). Runs in a Web Worker when available and falls
 * back to the calling thread if the worker fails. Aborting rejects with an AbortError and
 * terminates the worker. Works offline: the font ships in /fonts.
 */
export async function generateBoardsPdfDetailed(
  opts: PrintOptions,
  hooks: GenerateHooks = {},
): Promise<PdfResult> {
  if (hooks.signal?.aborted) throw aborted(hooks.signal);
  if (typeof Worker !== 'undefined') {
    try {
      return await inWorker(opts, hooks);
    } catch (err) {
      if (hooks.signal?.aborted) throw err;
      // fall through to the main thread
    }
  }
  return onMainThread(opts, hooks);
}

export async function generateBoardsPdf(
  opts: PrintOptions,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  return (await generateBoardsPdfDetailed(opts, { onProgress, signal })).bytes;
}
