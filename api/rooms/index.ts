import { z } from 'zod';
import { clientIp, enforce, HttpError, json, parseBody, route } from '../_lib/http.js';
import { redis } from '../_lib/redis.js';

/** Must match ROOM_ALPHABET in src/engine/codes.ts (no I, L, O, 0, 1). */
export const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/;
export const ROOM_TTL_SEC = 4 * 60 * 60;

const Body = z.object({
  code: z.string().regex(ROOM_CODE),
  hostKey: z
    .string()
    .min(80)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export default route(['POST'], async (request) => {
  const body = await parseBody(request, Body);
  await enforce(`rl:rooms:${clientIp(request)}`, 10, 60);
  const r = redis();
  const key = `room:${body.code}`;
  const set = await r.set(key, body.hostKey, { nx: true, ex: ROOM_TTL_SEC });
  if (set !== null) return json({ ok: true }, 201);
  // Idempotent re-registration (host resume): same key is fine, a different key is a clash.
  if ((await r.get<string>(key)) === body.hostKey) return json({ ok: true }, 200);
  throw new HttpError(409, 'code_taken');
});
