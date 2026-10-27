// Verify the exact committed tree before pushing/releasing (ADR 0014).
import { execFileSync, spawnSync } from 'node:child_process';

const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
  encoding: 'utf8',
});
if (changes.trim()) {
  console.error(
    'Release verification requires a clean checkout. Commit the intended changes first.',
  );
  process.exit(1);
}
for (const task of ['check', 'design-lint', 'build', 'e2e', 'test:replay-storage']) {
  const result = spawnSync('pnpm', [task], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  console.error('Verification changed tracked/generated files. Commit them and verify again.');
  process.exit(1);
}
console.log('Release verification passed: clean committed tree, checks, build and browser flows.');
