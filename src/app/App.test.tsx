import { describe, it, expect } from 'vitest';
import { routes } from './routes';

describe('router shell', () => {
  it('declares the placeholder routes', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '/',
      '/host',
      '/r/:code',
      '/solo',
      '/print',
      '/deck',
      '/creditos',
      '/ui',
    ]);
  });
});
