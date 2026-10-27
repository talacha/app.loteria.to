import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../i18n';
import Roster from './Roster';

afterEach(cleanup);
const ana = { seat: 'a', name: 'Ana', glyph: '🐆', pronouns: 'ella' };
const bo = { seat: 'b', name: 'Bo', glyph: '🌽' };

describe('Roster', () => {
  it('shows an empty state', () => {
    render(<Roster players={[]} />);
    expect(screen.getByText(/Nadie en la sala/)).toBeTruthy();
    expect(screen.getByText(/aparecerán/)).toBeTruthy();
  });
  it('pluralises the count', () => {
    const { rerender } = render(<Roster players={[ana]} />);
    expect(screen.getByText(/^1 persona en la sala/)).toBeTruthy();
    rerender(<Roster players={[ana, bo]} />);
    expect(screen.getByText(/^2 personas en la sala/)).toBeTruthy();
  });
  it('marks self and shows pronouns', () => {
    render(<Roster players={[ana, bo]} selfSeat="b" />);
    expect(screen.getByText('Tú · Bo')).toBeTruthy();
    expect(screen.getByText('ella')).toBeTruthy();
  });
  it('announces joins and leaves politely', () => {
    const { rerender } = render(<Roster players={[ana]} selfSeat="a" />);
    rerender(<Roster players={[ana, bo]} selfSeat="a" />);
    expect(screen.getByText('Bo entró a la sala')).toBeTruthy();
    rerender(<Roster players={[ana]} selfSeat="a" />);
    expect(screen.getByText('Bo salió de la sala')).toBeTruthy();
  });
  it('does not announce the initial roster, even when it arrives after mount', () => {
    const { rerender } = render(<Roster players={[]} selfSeat="a" />);
    rerender(<Roster players={[ana, bo]} selfSeat="a" />);
    expect(screen.queryByText(/entró a la sala/)).toBeNull();
  });
});
