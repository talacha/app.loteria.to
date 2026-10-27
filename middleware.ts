// Vercel Routing Middleware: link-preview bots (WhatsApp, iMessage, Telegram...) do not run JS,
// so /r/CODE gets its Open Graph tags injected into the static app shell here.
// Any failure passes through to the normal SPA rewrite.

export const config = { matcher: '/r/:path*' };

const SITE = 'https://app.loteria.to';
const CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const DESC =
  'Toca para unirte desde tu teléfono y elige en qué idioma escuchar las cartas: náhuatl, maya, quechua, español o inglés.';
const IMAGE = `${SITE}/og/invite.png`;
const IMAGE_ALT = 'Invitación a una sala de Lotería de los Pueblos.';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inviteHead(code: string | null): string {
  const title = code ? `¡Te invitaron a la Lotería! · Sala ${code}` : '¡Te invitaron a la Lotería!';
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(DESC)}" />`,
    `<meta name="robots" content="noindex,nofollow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Lotería de los Pueblos" />`,
    `<meta property="og:locale" content="es_MX" />`,
    `<meta property="og:locale:alternate" content="en_US" />`,
    ...(code ? [`<meta property="og:url" content="${SITE}/r/${code}" />`] : []),
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(DESC)}" />`,
    `<meta property="og:image" content="${IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(IMAGE_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(DESC)}" />`,
    `<meta name="twitter:image" content="${IMAGE}" />`,
    `<meta name="twitter:image:alt" content="${esc(IMAGE_ALT)}" />`,
  ];
  return tags.join('\n    ');
}

/** Removes the shell's generic title/description/robots/OG/Twitter/canonical tags. */
function stripGeneric(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(
      /<meta\s+(?:name|property)="(?:description|robots|og:[^"]*|twitter:[^"]*)"[^>]*>\s*/gi,
      '',
    )
    .replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>\s*/gi, '');
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
    const url = new URL(request.url);
    const raw = decodeURIComponent(url.pathname.slice('/r/'.length)).toUpperCase();
    const code = CODE_RE.test(raw) ? raw : null;

    // Forward auth-ish headers so the internal fetch also works on protected previews.
    const headers = new Headers();
    for (const h of ['cookie', 'x-vercel-protection-bypass', 'x-vercel-skip-toolbar']) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    const shell = await fetch(new URL('/app.html', url.origin), { headers });
    if (!shell.ok) return undefined;
    const html = await shell.text();
    if (!html.includes('</head>')) return undefined;
    const out = stripGeneric(html).replace('</head>', `    ${inviteHead(code)}\n  </head>`);
    return new Response(request.method === 'HEAD' ? null : out, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  } catch {
    return undefined;
  }
}
