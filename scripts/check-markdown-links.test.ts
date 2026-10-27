import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findBrokenMarkdownLinks, markdownFiles } from './check-markdown-links';

describe('Markdown link check', () => {
  let root = '';
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  it('resolves relative paths and ignores external, anchor-only, and fenced-code links', () => {
    root = mkdtempSync(join(tmpdir(), 'loteria-md-links-'));
    mkdirSync(join(root, 'docs'));
    mkdirSync(join(root, '.agents'));
    mkdirSync(join(root, 'node_modules', 'example'), { recursive: true });
    writeFileSync(join(root, 'docs', 'guide.md'), '# Guide\n');
    writeFileSync(
      join(root, 'docs', 'start.md'),
      [
        '[valid](guide.md#start)',
        '[missing](missing.md?view=full)',
        '[external](https://example.com/page)',
        '[anchor](#heading)',
        '```md',
        '[example](not-a-file.md)',
        '```',
      ].join('\n'),
    );
    writeFileSync(join(root, '.agents', 'notes.md'), '[ignored](missing.md)');
    writeFileSync(join(root, 'node_modules', 'example', 'readme.md'), '[ignored](missing.md)');

    expect(existsSync(join(root, '.git'))).toBe(false);
    expect(markdownFiles(root)).toEqual(['docs/guide.md', 'docs/start.md']);
    expect(findBrokenMarkdownLinks(root, ['docs/start.md'])).toEqual([
      { source: 'docs/start.md', target: 'missing.md?view=full', line: 2 },
    ]);
  });
});
