import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface MarkdownLinkIssue {
  source: string;
  target: string;
  line: number;
}

interface LinkTarget {
  target: string;
  line: number;
}

function withoutFencedCode(markdown: string): string {
  let fence: { marker: '`' | '~'; length: number } | null = null;
  return markdown
    .split('\n')
    .map((line) => {
      const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (!fence && match) {
        fence = { marker: match[1]![0] as '`' | '~', length: match[1]!.length };
        return '';
      }
      if (fence) {
        if (
          match &&
          match[1]![0] === fence.marker &&
          match[1]!.length >= fence.length &&
          /^\s*$/.test(line.slice(match[0].length))
        )
          fence = null;
        return '';
      }
      return line;
    })
    .join('\n');
}

function destinations(markdown: string): LinkTarget[] {
  const source = withoutFencedCode(markdown);
  const found: LinkTarget[] = [];
  const record = (target: string, offset: number) => {
    const line = source.slice(0, offset).split('\n').length;
    found.push({ target, line });
  };

  const inline = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|((?:\\.|[^\s)])+))(?:\s+[^)]*)?\s*\)/g;
  for (const match of source.matchAll(inline)) {
    const target = match[1] ?? match[2];
    if (target) record(target.replace(/\\([()])/g, '$1'), match.index);
  }

  const definitions = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm;
  for (const match of source.matchAll(definitions)) {
    const target = match[1] ?? match[2];
    if (target) record(target, match.index);
  }
  return found;
}

function localPath(target: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(target.trim());
    } catch {
      return target.trim();
    }
  })();
  if (
    !decoded ||
    decoded.startsWith('#') ||
    decoded.startsWith('/') ||
    /^([a-z][a-z\d+.-]*:|\/\/)/i.test(decoded)
  )
    return null;
  const filePath = decoded.split(/[?#]/, 1)[0]!;
  return filePath || null;
}

export function findBrokenMarkdownLinks(root: string, files: string[]): MarkdownLinkIssue[] {
  const issues: MarkdownLinkIssue[] = [];
  for (const file of files) {
    const source = resolve(root, file);
    const markdown = readFileSync(source, 'utf8');
    for (const link of destinations(markdown)) {
      const path = localPath(link.target);
      if (!path) continue;
      const destination = isAbsolute(path) ? path : resolve(root, dirname(file), path);
      if (!existsSync(destination)) {
        issues.push({ source: file, target: link.target, line: link.line });
      }
    }
  }
  return issues;
}

const EXCLUDED =
  /(^|\/)(?:\.git|\.agents|\.vercel|node_modules|dist|build|coverage|playwright-report|test-results|reports)(?:\/|$)/;

export function markdownFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string, relativeDirectory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (EXCLUDED.test(`${relativePath}/`)) continue;
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath, relativePath);
      else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(relativePath);
    }
  };
  visit(root, '');
  return files.sort();
}

function main(): number {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const files = markdownFiles(root);
  const issues = findBrokenMarkdownLinks(root, files);
  if (issues.length) {
    for (const issue of issues)
      console.error(
        `${issue.source}:${issue.line}: missing local Markdown target "${issue.target}"`,
      );
    console.error(`markdown-links: ${issues.length} broken link${issues.length === 1 ? '' : 's'}`);
    return 1;
  }
  console.log(`markdown-links: ok (${files.length} Markdown files)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
