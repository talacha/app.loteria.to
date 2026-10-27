import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme } from './prefs';
import { THEME_COLORS, watchThemeColor } from './themeColor';

const html = readFileSync('index.html', 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
let stop = () => {};
const colours = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) =>
    m.content.toUpperCase(),
  );

beforeEach(() => {
  const template = new DOMParser().parseFromString(html, 'text/html');
  for (const meta of template.querySelectorAll('meta[name="theme-color"]'))
    document.head.appendChild(meta.cloneNode(true));
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  stop = watchThemeColor(document);
});
afterEach(() => {
  stop();
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe('browser theme colours', () => {
  it('provides one token-based meta per OS scheme before JavaScript', () => {
    const template = new DOMParser().parseFromString(html, 'text/html');
    const metas = template.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    expect([...metas].map((m) => [m.getAttribute('media'), m.content])).toEqual([
      ['(prefers-color-scheme: dark)', THEME_COLORS.dark],
      ['(prefers-color-scheme: light)', THEME_COLORS.light],
    ]);
  });

  it.each(['dark', 'light', 'contrast'] as const)(
    'follows an explicit %s preference regardless of OS scheme',
    (theme) => {
      applyTheme(theme);
      expect(colours()).toEqual([THEME_COLORS[theme], THEME_COLORS[theme]]);
    },
  );

  it('returns both OS-specific colours when switching back to auto', () => {
    applyTheme('contrast');
    applyTheme('auto');
    expect(colours()).toEqual([THEME_COLORS.dark, THEME_COLORS.light]);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('follows and restores temporary contrast changes made outside preferences', async () => {
    applyTheme('light');
    document.documentElement.dataset.theme = 'contrast';
    await Promise.resolve();
    expect(colours()).toEqual([THEME_COLORS.contrast, THEME_COLORS.contrast]);
    document.documentElement.dataset.theme = 'light';
    await Promise.resolve();
    expect(colours()).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
  });

  it.each(['dark', 'light', 'contrast'] as const)(
    'applies stored %s chrome colour in the first-paint bootstrap',
    (theme) => {
      localStorage.setItem('loteria:theme', theme);
      new Function(bootstrap)();
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(colours()).toEqual([THEME_COLORS[theme], THEME_COLORS[theme]]);
    },
  );

  it('honours the legacy stored preference before first paint', () => {
    localStorage.setItem('loteria.theme', 'light');
    new Function(bootstrap)();
    expect(colours()).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
  });

  it('takes manifest background and chrome colours from the same tokens', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain('background_color: tokens.color.night.$value');
    expect(config).toContain('theme_color: tokens.color.maiz.$value');
  });
});
