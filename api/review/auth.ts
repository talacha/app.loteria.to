import { z } from 'zod';
import { reviewCode } from '../_lib/env.js';
import { clientIp, enforcePeek, HttpError, json, parseBody, rateHit, route } from '../_lib/http.js';
import { issueToken, safeEqual } from '../_lib/token.js';

export const LangSchema = z.enum(['es', 'en', 'nah', 'yua', 'quz']);
const Body = z.object({ lang: LangSchema, code: z.string().min(1).max(200) });

const WINDOW_SEC = 600;
const PER_IP_FAILURES = 5;
const GLOBAL_FAILURES = 50;

export default route(['POST'], async (request) => {
  const expected = reviewCode();
  const body = await parseBody(request, Body);
  const ipKey = `rl:review-auth:${clientIp(request)}`;
  const globalKey = 'rl:review-auth:global';
  // Only failures count: refuse once either budget is spent, even for the right code.
  await enforcePeek(ipKey, PER_IP_FAILURES, WINDOW_SEC);
  await enforcePeek(globalKey, GLOBAL_FAILURES, WINDOW_SEC);
  if (!safeEqual(body.code, expected)) {
    await Promise.all([rateHit(ipKey, WINDOW_SEC), rateHit(globalKey, WINDOW_SEC)]);
    throw new HttpError(401, 'invalid_code');
  }
  const { token, expiresAt } = issueToken(body.lang);
  return json({ token, expiresAt }, 200, { 'cache-control': 'no-store' });
});
