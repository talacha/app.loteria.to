import i18n from 'i18next';
import { mergeProfile, readRawProfile } from '../ui/profile';

export type ThemePref = 'auto' | 'dark' | 'light' | 'contrast';
export const THEMES: ThemePref[] = ['auto', 'dark', 'light', 'contrast'];
export type UiLang = 'es' | 'en';

export const THEME_KEY = 'loteria:theme';
const LEGACY_THEME_KEY = 'loteria.theme';
const LANG_KEY = 'loteria.lang';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preference lasts for this visit only */
  }
}

export function getTheme(): ThemePref {
  const v = read(THEME_KEY) ?? read(LEGACY_THEME_KEY);
  return THEMES.find((t) => t === v) ?? 'auto';
}

/** Set <html data-theme>: absent = auto (follows the OS). */
export function applyTheme(theme: ThemePref): void {
  if (typeof document === 'undefined') return;
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: ThemePref): void {
  applyTheme(theme);
  write(THEME_KEY, theme);
}

export function setUiLang(lang: UiLang): void {
  write(LANG_KEY, lang);
  mergeProfile({ uiLang: lang });
  void i18n.changeLanguage(lang);
}

/** Apply stored theme and language. Safe to call more than once. */
export function applyStoredPrefs(): void {
  applyTheme(getTheme());
  const stored = readRawProfile().uiLang ?? read(LANG_KEY);
  if ((stored === 'es' || stored === 'en') && i18n.language !== stored)
    void i18n.changeLanguage(stored);
}
