import tokens from '../../../design/tokens.json';

/** Browser chrome uses the same night/maíz palette as the app. */
export const THEME_COLORS = {
  dark: tokens.color.night.$value,
  light: tokens.color.maiz.$value,
  contrast: tokens.theme.contrast.night.$value,
};

export function updateThemeColor(doc: Document): void {
  const theme = doc.documentElement.dataset.theme;
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.getAttribute('media')?.includes('light') ? 'light' : 'dark';
    meta.content =
      theme === 'dark' || theme === 'light' || theme === 'contrast'
        ? THEME_COLORS[theme]
        : THEME_COLORS[scheme];
  }
}

const observers = new WeakMap<Document, MutationObserver>();

/** Also follows temporary contrast mode, which changes data-theme directly. */
export function watchThemeColor(doc: Document): () => void {
  updateThemeColor(doc);
  let observer = observers.get(doc);
  if (!observer) {
    observer = new MutationObserver(() => updateThemeColor(doc));
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    observers.set(doc, observer);
  }
  return () => {
    observer.disconnect();
    observers.delete(doc);
  };
}
