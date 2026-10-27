import type { Lang } from '@engine';
import { LANGS } from '@content';
import { mergeProfile } from '../ui/profile';

export const PROFILE_KEY = 'loteria:profile';

export type UiLang = 'es' | 'en';

/** What is stored locally for this player: 'loteria:profile'. */
export interface LocalProfile {
  name: string;
  glyph: string;
  uiLang: UiLang;
  spokenLang: Lang;
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function readLocalProfile(): Partial<LocalProfile> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return {};
    const o = v as Record<string, unknown>;
    return {
      name: typeof o.name === 'string' ? o.name.slice(0, 40) : undefined,
      glyph: typeof o.glyph === 'string' ? o.glyph : undefined,
      uiLang: o.uiLang === 'en' || o.uiLang === 'es' ? o.uiLang : undefined,
      // `labelLang` is what earlier versions stored.
      spokenLang: isLang(o.spokenLang)
        ? o.spokenLang
        : isLang(o.labelLang)
          ? o.labelLang
          : undefined,
    };
  } catch {
    return {};
  }
}

/** Merge into the stored profile so fields written elsewhere (pronouns...) survive. */
export function patchLocalProfile(patch: Partial<LocalProfile>): void {
  mergeProfile({ ...patch });
}
