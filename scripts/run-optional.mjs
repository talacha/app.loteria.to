// Runs a tsx script if it exists, else exits 0. Usage: node scripts/run-optional.mjs scripts/foo.ts
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const target = process.argv[2];
if (!target || !existsSync(target)) {
  if (process.env.CI) {
    console.error(`[fail] ${target ?? '(no script)'} not found in CI`);
    process.exit(1);
  }
  console.log(`[skip] ${target ?? '(no script)'} not found`);
  process.exit(0);
}
const r = spawnSync('pnpm', ['exec', 'tsx', target], { stdio: 'inherit' });
process.exit(r.status ?? 1);
