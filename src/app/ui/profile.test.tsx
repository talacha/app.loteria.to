import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '../i18n';
import LanguageSettings from './LanguageSettings';
import { mergeProfile, readRawProfile, setAllowedSpokenLangs } from './profile';

afterEach(() => {
  cleanup();
  setAllowedSpokenLangs(null);
  localStorage.clear();
});

describe('active round language coverage', () => {
  it('disables unsupported gear options and permits them after the round leaves', () => {
    mergeProfile({ spokenLang: 'es' });
    setAllowedSpokenLangs(['es', 'en']);
    render(<LanguageSettings />);
    expect((screen.getByRole('radio', { name: /Náhuatl/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    act(() => mergeProfile({ spokenLang: 'nah' }));
    expect(readRawProfile().spokenLang).toBe('es');
    act(() => mergeProfile({ spokenLang: 'en' }));
    expect(readRawProfile().spokenLang).toBe('en');
    act(() => setAllowedSpokenLangs(null));
    expect((screen.getByRole('radio', { name: /Náhuatl/ }) as HTMLButtonElement).disabled).not.toBe(
      true,
    );
    act(() => mergeProfile({ spokenLang: 'nah' }));
    expect(readRawProfile().spokenLang).toBe('nah');
  });
});
