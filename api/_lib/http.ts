import { z } from 'zod';
import { NotConfigured, publicOrigin } from './env.js';
import { redis } from './redis.js';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;
  constructor(status: number, code: string, headers: Record<string, string> = {}) {
    super(code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export const noContent = (): Response => new Response(null, { status: 204 });

export type Handler = (request: Request) => Promise<Response>;

/**
 * Wraps a handler: method guard, same-origin only (no CORS headers are ever emitted, and a
 * cross-origin `Origin` is refused), and uniform JSON errors. Never logs request data.
 */
export function route(methods: readonly string[], handler: Handler): { fetch: Handler } {
  return {
    async fetch(request) {
      try {
        if (!methods.includes(request.method)) {
          throw new HttpError(405, 'method_not_allowed', { allow: methods.join(', ') });
        }
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin) {
          throw new HttpError(403, 'cross_origin');
        }
        return await handler(request);
      } catch (err) {
        return errorResponse(err);
      }
    },
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.code }, err.status, err.headers);
  if (err instanceof NotConfigured) {
    return json({ error: 'not_configured', feature: err.feature }, 503);
  }
  if (err instanceof z.ZodError) return json({ error: 'invalid_input' }, 400);
  console.error('unhandled_error', err instanceof Error ? err.name : 'unknown');
  return json({ error: 'internal' }, 500);
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  return schema.parse(raw);
}

/** Collapse an IPv6 address to its /64 prefix so one host cannot rotate through its range. */
function normalizeIp(ip: string): string {
  if (!ip.includes(':')) return ip;
  if (ip.includes('.')) return ip.slice(ip.lastIndexOf(':') + 1); // IPv4-mapped
  const [head = '', tail] = ip.split('%')[0]!.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? h
      : [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  const prefix = groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''));
  return `${prefix.join(':')}::/64`;
}

/**
 * Client IP, preferring headers the platform sets (not client-spoofable): Vercel's own header,
 * then x-real-ip, then the LAST hop of x-forwarded-for (never the first, which clients control).
 */
export function clientIp(request: Request): string {
  const h = request.headers;
  const last = h.get('x-forwarded-for')?.split(',').pop()?.trim();
  const ip = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || last;
  return ip ? normalizeIp(ip) : 'unknown';
}

/** Atomic fixed-window hit: INCR + EXPIRE NX in one MULTI. Returns the new count. */
export async function rateHit(key: string, windowSec: number): Promise<number> {
  const res = await redis().multi().incr(key).expire(key, windowSec, 'NX').exec();
  return Number(res[0]);
}

/** Count current usage without incrementing. */
export async function rateCount(key: string): Promise<number> {
  return Number((await redis().get(key)) ?? 0);
}

const tooMany = (windowSec: number): HttpError =>
  new HttpError(429, 'rate_limited', { 'retry-after': String(windowSec) });

/** Count a request and throw 429 (with Retry-After) once over the limit. */
export async function enforce(key: string, limit: number, windowSec: number): Promise<void> {
  if ((await rateHit(key, windowSec)) > limit) throw tooMany(windowSec);
}

/** Throw 429 if the key is already at the limit, without counting this request. */
export async function enforcePeek(key: string, limit: number, windowSec: number): Promise<void> {
  if ((await rateCount(key)) >= limit) throw tooMany(windowSec);
}

export function origin(request: Request): string {
  return publicOrigin() ?? new URL(request.url).origin;
}
