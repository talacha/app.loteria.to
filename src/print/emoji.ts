/**
 * Render emoji to PNG bytes with the system emoji font. pdf-lib fonts cannot draw colour emoji.
 * Works in a worker (OffscreenCanvas) or on the main thread (DOM canvas). Returns an empty
 * map when neither is available; callers then print names only.
 */
const SIZE = 192;
const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function paint(ctx: Ctx, art: string): void {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.font = `${Math.round(SIZE * 0.78)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(art, SIZE / 2, SIZE / 2 + SIZE * 0.04);
}

export function canvasAvailable(): boolean {
  if (typeof OffscreenCanvas !== 'undefined') return true;
  if (typeof document === 'undefined') return false;
  try {
    return document.createElement('canvas').getContext('2d') !== null;
  } catch {
    return false;
  }
}

export async function renderEmojiPngs(
  items: { id: string; art: string }[],
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(SIZE, SIZE);
      const ctx = canvas.getContext('2d');
      if (!ctx) return out;
      for (const it of items) {
        paint(ctx, it.art);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        out.set(it.id, new Uint8Array(await blob.arrayBuffer()));
      }
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return out;
      for (const it of items) {
        paint(ctx, it.art);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
        if (blob) out.set(it.id, new Uint8Array(await blob.arrayBuffer()));
      }
    }
  } catch {
    out.clear();
  }
  return out;
}
