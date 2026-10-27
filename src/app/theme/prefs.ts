import i18n from 'i18next';

export type ThemePref = 'auto' | 'light' | 'contrast';
export type UiLang = 'es' | 'en';

const THEME_KEY = 'loteria.theme';
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
  const v = read(THEME_KEY);
  return v === 'contrast' || v === 'light' ? v : 'auto';
}

export function setTheme(theme: ThemePref): void {
  if (typeof document !== 'undefined') {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }
  write(THEME_KEY, theme);
}

export function setUiLang(lang: UiLang): void {
  write(LANG_KEY, lang);
  void i18n.changeLanguage(lang);
}

/** Apply stored theme and language. Safe to call more than once. */
export function applyStoredPrefs(): void {
  const theme = getTheme();
  if (theme !== 'auto') setTheme(theme);
  const lang = read(LANG_KEY);
  if ((lang === 'es' || lang === 'en') && i18n.language !== lang) void i18n.changeLanguage(lang);
}
