import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CardFace from './CardFace';

describe('CardFace', () => {
  it('recovers from failed assets when the called card changes', () => {
    const { container, rerender } = render(<CardFace cardId="sol" name="Sol" size="cell" />);
    fireEvent.error(screen.getByRole('img', { name: 'Sol' }));
    fireEvent.error(screen.getByRole('img', { name: 'Sol' }));
    expect(screen.getByRole('img', { name: 'Sol' }).tagName).toBe('SPAN');
    rerender(<CardFace cardId="jaguar" name="Jaguar" size="cell" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/cards/jaguar.webp');
  });

  it('does not reveal a written answer when used as a picture-only card', () => {
    const { container } = render(<CardFace cardId="sol" size="cell" showName={false} />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
