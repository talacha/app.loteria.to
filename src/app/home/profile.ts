/** Shared with the join flow: localStorage 'loteria:profile' = {name, glyph, pronouns?, labelLang?}. */
import { PROFILE_KEY, mergeProfile } from '../ui/profile';
export { PROFILE_KEY };
export const NAME_MAX = 40;

export interface StoredProfile {
  name: string;
  glyph: string;
  pronouns?: string;
  labelLang?: string;
}

export function readProfile(): Partial<StoredProfile> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return {};
    const o = v as Record<string, unknown>;
    return {
      name: typeof o.name === 'string' ? o.name.slice(0, NAME_MAX) : undefined,
      glyph: typeof o.glyph === 'string' ? o.glyph : undefined,
      pronouns: typeof o.pronouns === 'string' && o.pronouns ? o.pronouns : undefined,
      labelLang: typeof o.labelLang === 'string' ? o.labelLang : undefined,
    };
  } catch {
    return {};
  }
}

/** Merge into the stored profile so fields written by the join page (pronouns, labelLang) survive. */
export function saveProfile(patch: Partial<StoredProfile>): void {
  mergeProfile({ ...patch });
}
