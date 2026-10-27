import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('loads the compiled middleware without app source files in its deployment package', () => {
  const directory = mkdtempSync(join(tmpdir(), 'loteria-middleware-'));
  try {
    const source = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const entry = join(directory, 'middleware.mjs');
    writeFileSync(entry, compiled);
    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      const { default: middleware } = await import(${JSON.stringify(pathToFileURL(entry).href)});
      globalThis.fetch = async () => new Response('<html><head></head><body></body></html>');
      const response = await middleware(new Request('https://app.loteria.to/r/ABCDE'));
      console.log(JSON.stringify({ status: response.status, html: await response.text() }));
    `,
      ],
      { encoding: 'utf8' },
    );
    const response = JSON.parse(result);
    expect(response.status).toBe(200);
    expect(response.html).toContain('og/invite.png?v=2');
    expect(response.html).toContain('noindex,nofollow');
    expect(response.html).toContain('Sala ABCDE');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
