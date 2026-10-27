// Writes src/content/card-art.json: the card ids that have public/cards/<id>.webp, so the UI never
// requests a missing illustration. Run before `vite build` (see the `build` script).
// Usage: node scripts/cards-index.mjs [cardsDir] [outFile]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Width and height of a WebP buffer (VP8, VP8L or VP8X), or null if it is not a WebP. */
export function webpSize(buf) {
  if (
    buf.length < 30 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  )
    return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X')
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ')
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

/** Sorted index of every <id>.webp in `dir`. */
export function buildIndex(dir) {
  const entries = readdirSync(dir)
    .filter((f) => /^[a-z0-9_-]+\.webp$/.test(f))
    .sort();
  return entries.map((f) => {
    const buf = readFileSync(join(dir, f));
    const size = webpSize(buf);
    if (!size) throw new Error(`${f} is not a valid WebP`);
    return {
      id: f.slice(0, -5),
      sha256: createHash('sha256').update(buf).digest('hex'),
      ...size,
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? fileURLToPath(new URL('../public/cards/', import.meta.url));
  const out =
    process.argv[3] ?? fileURLToPath(new URL('../src/content/card-art.json', import.meta.url));
  const index = buildIndex(dir);
  writeFileSync(out, JSON.stringify(index, null, 2) + '\n');
  console.log(`cards-index: ${index.length} illustrated cards -> ${out}`);
}
