import { canvasAvailable, renderEmojiPngs } from './emoji';

export interface PrintImage {
  format: 'jpeg' | 'png';
  bytes: Uint8Array;
}

interface ArtItem {
  id: string;
  art: string;
  url: string | null;
}
type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Decode the same WebP shown by the app, then convert to a PDF-supported image format. */
async function jpeg(blob: Blob): Promise<Uint8Array> {
  let picture: CanvasImageSource;
  let width: number;
  let height: number;
  let release: () => void;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    picture = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    release = () => bitmap.close();
  } else if (typeof Image !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Card illustration failed to decode'));
        image.src = url;
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    picture = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    release = () => URL.revokeObjectURL(url);
  } else throw new Error('No image decoder for PDF illustrations');

  try {
    // At most 240px on the long edge: enough for printed cells without embedding full originals.
    const scale = Math.min(1, 240 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d') as DrawingContext | null;
    if (!context) throw new Error('No canvas for PDF illustrations');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, w, h);
    context.drawImage(picture, 0, 0, w, h);
    const result =
      'convertToBlob' in canvas
        ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 })
        : await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (image) => (image ? resolve(image) : reject(new Error('PDF image encoding failed'))),
              'image/jpeg',
              0.86,
            ),
          );
    return new Uint8Array(await result.arrayBuffer());
  } finally {
    release();
  }
}

/** Cover pictures first; emoji remain a fallback for missing or undecodable assets. */
export async function renderPrintArt(
  items: ArtItem[],
  signal?: AbortSignal,
): Promise<Map<string, PrintImage>> {
  const images = new Map<string, PrintImage>();
  if (!canvasAvailable()) return images;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++]!;
        signal?.throwIfAborted();
        if (!item.url) continue;
        try {
          const response = await fetch(item.url, { signal });
          if (!response.ok) continue;
          images.set(item.id, { format: 'jpeg', bytes: await jpeg(await response.blob()) });
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }
    }),
  );
  const fallback = await renderEmojiPngs(items.filter((item) => !images.has(item.id)));
  for (const [id, bytes] of fallback) images.set(id, { format: 'png', bytes });
  return images;
}
