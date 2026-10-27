/** Catalog key (in ns `ui`) for the page title of a route. */
export function titleKey(pathname: string): string {
  if (pathname === '/') return 'home.title';
  if (pathname.startsWith('/host')) return 'host.title';
  if (pathname.startsWith('/r/')) return 'join.title';
  if (pathname.startsWith('/print')) return 'print.title';
  if (pathname.startsWith('/solo')) return 'solo.title';
  if (pathname.startsWith('/deck')) return 'deck.title';
  if (pathname.startsWith('/creditos')) return 'credits.title';
  if (pathname.startsWith('/ui')) return 'app.name';
  return 'notfound.title';
}
