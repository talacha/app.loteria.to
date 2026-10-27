// Upload lossless WAV masters (audio-masters/, git-ignored) to the PRIVATE Supabase Storage bucket
// `audio-masters`. Service role only; the key is read from .env.local and never printed.
// Usage: pnpm audio:upload-masters
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'audio-masters';
const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).');
  process.exit(1);
}
const h = { Authorization: `Bearer ${key}`, apikey: key };
const fail = async (what, r) => {
  console.error(`${what}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  process.exit(1);
};

// Bucket (also created by supabase/migrations/0002_audio_masters.sql): private, WAV only.
let r = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: h });
if (r.status === 404 || r.status === 400) {
  r = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, allowed_mime_types: ['audio/wav', 'audio/x-wav'] }),
  });
  if (!r.ok) await fail('create bucket', r);
  console.log(`created private bucket ${BUCKET}`);
} else if (!r.ok) await fail('get bucket', r);
else if ((await r.json()).public) {
  console.error(`bucket ${BUCKET} is public; refusing to upload.`);
  process.exit(1);
}

const files = [];
for (const lang of readdirSync('audio-masters')) {
  const d = join('audio-masters', lang);
  if (statSync(d).isDirectory()) for (const f of readdirSync(d)) if (f.endsWith('.wav')) files.push(`${lang}/${f}`);
}
let ok = 0;
for (const f of files) {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${f}`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'audio/wav', 'x-upsert': 'true' },
    body: readFileSync(join('audio-masters', f)),
  });
  if (!res.ok) await fail(`upload ${f}`, res);
  ok++;
}
// Count what is stored (per language folder).
let stored = 0;
for (const lang of new Set(files.map((f) => f.split('/')[0]))) {
  const l = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: lang, limit: 1000 }),
  });
  if (l.ok) stored += (await l.json()).filter((o) => o.name.endsWith('.wav')).length;
}
console.log(`uploaded ${ok}/${files.length} masters; ${stored} objects now in private bucket ${BUCKET}`);
