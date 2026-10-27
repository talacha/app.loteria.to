import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware from '../../../middleware';
import { routeSeo } from './meta';

afterEach(() => vi.unstubAllGlobals());
const shell =
  '<html><head><title>Home</title><meta name="keywords" content="home"><meta property="og:title" content="Home"><link rel="canonical" href="https://app.loteria.to/"></head><body></body></html>';

describe('server-rendered invitation previews', () => {
  it('uses shared invitation metadata without indexing or exposing URL secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(shell)));
    const response = await middleware(
      new Request('https://app.loteria.to/r/ABCDE?tracking=x#k=secret'),
    );
    const html = await response!.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seo = routeSeo('/r/ABCDE', 'es');
    expect(doc.title).toBe(seo.title);
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(seo.image);
    expect(doc.querySelector('meta[property="og:image:type"]')?.getAttribute('content')).toBe(
      'image/png',
    );
    expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://app.loteria.to/r/ABCDE',
    );
    expect(doc.querySelector('link[rel="canonical"], meta[name="keywords"]')).toBeNull();
    expect(html).not.toContain('secret');
    expect(html).not.toContain('tracking');
    expect(response!.headers.get('x-robots-tag')).toContain('noindex');
  });
  it('returns headers without a body for HEAD and avoids invented invalid-room URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(shell))),
    );
    const head = await middleware(
      new Request('https://app.loteria.to/r/ABCDE', { method: 'HEAD' }),
    );
    expect(await head!.text()).toBe('');
    const invalid = await middleware(new Request('https://app.loteria.to/r/invalid'));
    expect(await invalid!.text()).not.toContain('og:url');
  });
});
