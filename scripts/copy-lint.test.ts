import { describe, expect, it } from 'vitest';
import { PRONOUN_KEY, findHits, langOf, walkStrings } from './copy-lint';

const words = (s: string) => findHits(s).map((h) => h.word.toLowerCase());

describe('copy-lint matcher', () => {
  it('flags gendered Spanish roles', () => {
    for (const w of [
      'jugador',
      'jugadores',
      'ganador',
      'ganadora',
      'ganadores',
      'niños',
      'maestro',
      'maestra',
    ]) {
      expect(words(`Cada ${w} espera`)).toEqual([w]);
    }
  });
  it('flags generic he/she in English but not substrings', () => {
    expect(words('He said she would')).toEqual(['he', 'she']);
    expect(words('The heart and the shelf, other')).toEqual([]);
    expect(words('he/she picks')).toContain('he/she');
  });
  it('flags framing words', () => {
    expect(words('Gana dinero y un premio')).toEqual(['gana', 'dinero', 'premio']);
    expect(words('No bet, no prize, no chips, sin fichas ni apuesta').sort()).toEqual([
      'apuesta',
      'bet',
      'chips',
      'fichas',
      'prize',
    ]);
  });
  it('allows cantor and neutral copy', () => {
    expect(
      findHits('Quien canta; quien juega usa frijoles. Beans, not better bets? '),
    ).toHaveLength(1);
    expect(findHits('La cantora y quien canta revisan la tabla')).toEqual([]);
    // "el cantor" is the app's automatic voice, not a person: allowed.
    expect(findHits('Pregunta al cantor y al  Cantor del cantor', 'es')).toEqual([]);
    expect(findHits('The cantor calls', 'en')).toEqual([]);
    expect(findHits('Ser cantor', 'es')).toEqual([]);
    expect(findHits('Se juega con frijoles. Las infancias y las personas mayores.')).toEqual([]);
  });
  it('is Unicode aware at word boundaries', () => {
    expect(findHits('chipotle ñiños fichaje')).toEqual([]);
  });
  it('exempts pronoun picker keys', () => {
    expect(PRONOUN_KEY.test('pronounsPlaceholder')).toBe(true);
    expect(PRONOUN_KEY.test('join.pronounsLabel')).toBe(true);
    expect(PRONOUN_KEY.test('join.title')).toBe(false);
  });
  it('walks strings with key paths and skips non-copy keys', () => {
    const got = [...walkStrings({ a: { b: 'x', tags: ['jugador'] }, c: ['y'], id: 'jugador' }, '')];
    expect(got).toEqual([
      ['a.b', 'x'],
      ['c[0]', 'y'],
    ]);
  });

  it('applies language-specific rules only to that language', () => {
    expect(findHits('he jugado', 'es')).toEqual([]);
    expect(words('he jugado y el ganador').sort()).toEqual(['ganador', 'he']);
    expect(findHits('She won', 'es')).toEqual([]);
    expect(findHits('el ganador', 'en')).toEqual([]);
    expect(findHits('she', 'other')).toEqual([]);
    expect(findHits('premio', 'other')).toHaveLength(1);
  });
  it('flags winning and extra roles', () => {
    expect(words('The winner wins, they won')).toEqual(['winner', 'wins', 'won']);
    for (const w of [
      'gana',
      'ganar',
      'ganó',
      'ganen',
      'niño',
      'niña',
      'niñas',
      'alumnos',
      'jugadorxs',
    ]) {
      expect(findHits(`Todos ${w} aquí`, 'es')).toHaveLength(1);
    }
    expect(findHits('Tengo ganas de jugar', 'es')).toEqual([]);
  });
  it('does not flag fixed phrases', () => {
    expect(findHits('Una obra maestra con ficha técnica', 'es')).toEqual([]);
    expect(findHits('Un maestro y una ficha', 'es')).toHaveLength(2);
  });
  it('normalises to NFC', () => {
    expect(findHits('gano\u0301', 'es')).toHaveLength(1);
    expect(findHits('gan\u006f\u0301', 'es')).toHaveLength(1);
    expect(findHits('nin\u0303os', 'es')).toHaveLength(1);
  });
  it('detects language from file or key path', () => {
    expect(langOf('src/content/i18n/es.json', 'a.b')).toBe('es');
    expect(langOf('src/app/home/strings.en.json', 'x')).toBe('en');
    expect(langOf('src/content/cards.json', '[3].verso.en')).toBe('en');
    expect(langOf('src/content/cards.json', '[3].names.nah.text')).toBe('other');
  });
});
