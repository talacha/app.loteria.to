// Fast CI check (no models): every card x language with a word has a clip listed in
// public/audio/manifest.json whose file exists and whose sha256 matches; cards.json agrees with the
// manifest; a name without audio carries an allowed reason. Missing or tampered clips fail the build
// instead of being generated on demand. Usage: node scripts/audio/check.mjs
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync('src/content/cards.json', 'utf8'));
const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8'));
const engines = JSON.parse(readFileSync('scripts/audio/engines.json', 'utf8')).languages;

const sha = (file) => createHash('sha256').update(readFileSync(`public${file}`)).digest('hex');
const byFile = new Map(Object.values(manifest.clips).map((v) => [v.file, v]));
const problems = [];
let clips = 0;
let waiting = 0;
const verified = new Map();
const verify = (file, expect, who) => {
  if (!existsSync(`public${file}`)) return problems.push(`${who}: file missing ${file}`);
  if (!verified.has(file)) verified.set(file, sha(file));
  if (verified.get(file) !== expect) problems.push(`${who}: sha256 mismatch for ${file}`);
};

for (const c of cards) {
  for (const [lang, n] of Object.entries(c.names)) {
    const who = `${lang}/${c.id}`;
    const spec = engines[lang];
    if (!spec) {
      problems.push(`${who}: language not in scripts/audio/engines.json`);
      continue;
    }
    if (n.text === null) {
      if (n.audio !== null || n.audioReason !== 'missing-word') problems.push(`${who}: missing word must have audio null, audioReason missing-word`);
      continue;
    }
    if (!n.audio) {
      if (spec.engine === 'needs-recording' && n.audioReason === 'needs-recording') waiting++;
      else problems.push(`${who}: no audio and no allowed reason`);
      continue;
    }
    const m = byFile.get(n.audio);
    if (!m) {
      problems.push(`${who}: ${n.audio} not in manifest`);
      continue;
    }
    if (!n.clip || n.clip.file !== n.audio || n.clip.sha256 !== m.sha256)
      problems.push(`${who}: cards.json clip metadata disagrees with manifest`);
    verify(n.audio, m.sha256, who);
    clips++;
  }
}
for (const v of Object.values(manifest.clips)) verify(v.file, v.sha256, `manifest ${v.lang}/${v.id}`);

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`[audio:check] FAIL (${problems.length}). Run pnpm audio:generate and commit public/audio.`);
  process.exit(1);
}
console.log(`[audio:check] ok: ${clips} clips verified (sha256), ${waiting} awaiting native recordings`);
