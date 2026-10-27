import { useSyncExternalStore } from 'react';
import type { Lang } from '@content';

/** localStorage 'loteria:profile' is shared: {name, glyph, pronouns?, labelLang?, uiLang?, spokenLang?}. */
export const PROFILE_KEY = 'loteria:profile';
export type UiLang = 'es' | 'en';
export const SPOKEN_LANGS: Lang[] = ['nah', 'yua', 'quz', 'es', 'en'];

export interface Profile {
  uiLang: UiLang;
  spokenLang: Lang;
}

type Raw = Record<string, unknown>;
const listeners = new Set<() => void>();
let allowedSpokenLangs: readonly Lang[] = SPOKEN_LANGS;

/** Active rounds freeze their card pool; unavailable voices cannot replace the current one. */
export function setAllowedSpokenLangs(langs: readonly Lang[] | null): void {
  allowedSpokenLangs = langs ?? SPOKEN_LANGS;
  listeners.forEach((listener) => listener());
}

export function readRawProfile(): Raw {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};
  } catch {
    return {};
  }
}

/** Merge into the stored profile, keeping every other key, and notify subscribers. */
export function mergeProfile(patch: Raw): void {
  if (
    typeof patch.spokenLang === 'string' &&
    !allowedSpokenLangs.includes(patch.spokenLang as Lang)
  ) {
    patch = { ...patch };
    delete patch.spokenLang;
  }
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readRawProfile(), ...patch }));
  } catch {
    /* storage unavailable: lasts for this visit only */
  }
  listeners.forEach((l) => l());
}

export function storedProfile(): Profile {
  const raw = readRawProfile();
  const uiLang: UiLang = raw.uiLang === 'en' ? 'en' : 'es';
  const spokenLang = SPOKEN_LANGS.find((l) => l === raw.spokenLang) ?? 'es';
  return { uiLang, spokenLang };
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROFILE_KEY || e.key === null) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}
const snapshot = () => {
  try {
    return `${localStorage.getItem(PROFILE_KEY) ?? ''}|${allowedSpokenLangs.join(',')}`;
  } catch {
    return `|${allowedSpokenLangs.join(',')}`;
  }
};

/** Language preferences: `uiLang` (app text) and `spokenLang` (language you hear). */
export function useProfile(): Profile & {
  availableSpokenLangs: readonly Lang[];
  update: (patch: Partial<Profile>) => void;
} {
  useSyncExternalStore(subscribe, snapshot, () => '');
  return {
    ...storedProfile(),
    availableSpokenLangs: allowedSpokenLangs,
    update: (patch) => mergeProfile({ ...patch }),
  };
}
