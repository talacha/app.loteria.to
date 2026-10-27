import { describe, expect, it } from 'vitest';
import { checkDeclaration, lintCss, lintTsx } from './design-lint';

const rules = (css: string) => lintCss(css).map((f) => f.rule);

describe('design-lint CSS', () => {
  it('accepts tokens', () => {
    expect(
      rules(`.a { color: var(--color-ink); background: var(--color-paper); border: var(--border-thick);
        border-radius: var(--radius-lg); box-shadow: var(--shadow-hard); font-family: var(--font-ui);
        outline: 3px solid var(--color-maiz); border-color: transparent; fill: currentColor; }`),
    ).toEqual([]);
  });
  it('flags raw colours', () => {
    expect(rules('.a { color: #fff; }')).toEqual(['raw-color']);
    expect(rules('.a { background: rgb(0 0 0 / 50%); }')).toEqual(['raw-color']);
    expect(rules('.a { border: 2px solid hsl(10, 50%, 50%); }')).toEqual(['raw-color']);
    expect(rules('.a { --x: #123456; }')).toEqual(['raw-color']);
  });
  it('flags named colours but not transparent/currentColor/inherit', () => {
    expect(rules('.a { color: red; }')).toEqual(['named-color']);
    expect(rules('.a { background: white; }')).toEqual(['named-color']);
    expect(rules('.a { color: inherit; background: transparent; fill: currentColor; }')).toEqual(
      [],
    );
  });
  it('flags font-family literals', () => {
    expect(rules(".a { font-family: 'Noto Sans', sans-serif; }")).toEqual(['font-family']);
    expect(rules('.a { font-family: inherit; }')).toEqual([]);
  });
  it('flags raw border radius', () => {
    expect(rules('.a { border-radius: 12px; }')).toEqual(['radius']);
    expect(rules('.a { border-radius: 0; }')).toEqual([]);
    expect(rules('.a { border-radius: 50%; }')).toEqual([]);
    expect(rules('.a { border-top-left-radius: 8px; }')).toEqual(['radius']);
  });
  it('flags non-token box shadows but allows selection rings', () => {
    expect(rules('.a { box-shadow: 0 2px 8px var(--color-shadow); }')).toEqual(['shadow']);
    expect(rules('.a { box-shadow: var(--shadow-hard), 0 0 0 4px var(--lang-es); }')).toEqual([]);
    expect(rules('.a { box-shadow: none; }')).toEqual([]);
  });
  it('ignores selectors, comments and reports line numbers', () => {
    const css = '/* color: red; */\na:hover { x: 1 }\n.b {\n  color: #abc;\n}';
    expect(lintCss(css)).toEqual([{ line: 4, rule: 'raw-color', message: expect.any(String) }]);
  });
  it('checkDeclaration reports every rule hit', () => {
    expect(checkDeclaration('border', '3px solid #000').map((f) => f.rule)).toEqual(['raw-color']);
  });
});

describe('design-lint TSX', () => {
  it('flags style literals', () => {
    const src = `const a = <div style={{ color: '#fff', borderRadius: 12, boxShadow: '0 1px 2px red', fontFamily: 'serif' }} />;`;
    expect(
      lintTsx(src)
        .map((f) => f.rule)
        .sort(),
    ).toEqual(['font-family', 'named-color', 'radius', 'raw-color', 'shadow'].sort());
  });
  it('allows tokens in style', () => {
    expect(lintTsx(`<p style={{ color: 'var(--color-paper)', fontWeight: 700 }} />`)).toEqual([]);
  });
});
