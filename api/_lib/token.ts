import { createHmac, timingSafeEqual } from 'node:crypto';
import { reviewCode } from './env.js';
import { HttpError } from './http.js';

export const TOKEN_TTL_SEC = 2 * 60 * 60;

const b64 = (s: string): string => Buffer.from(s).toString('base64url');
const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function issueToken(lang: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(now / 1000) + TOKEN_TTL_SEC;
  const payload = b64(JSON.stringify({ lang, exp: expiresAt }));
  return { token: `${payload}.${sign(payload, reviewCode())}`, expiresAt };
}

/** Returns the language the token was issued for, or throws 401. */
export function verifyToken(request: Request, now = Date.now()): string {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload, reviewCode()))) {
    throw new HttpError(401, 'unauthorized');
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      lang?: unknown;
      exp?: unknown;
    };
    if (typeof data.lang !== 'string' || typeof data.exp !== 'number') throw new Error();
    if (data.exp * 1000 < now) throw new HttpError(401, 'token_expired');
    return data.lang;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'unauthorized');
  }
}
