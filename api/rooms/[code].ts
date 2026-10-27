import { clientIp, enforce, HttpError, json, route } from '../_lib/http.js';
import { redis } from '../_lib/redis.js';
import { ROOM_CODE } from './index.js';

export default route(['GET'], async (request) => {
  const code = new URL(request.url).pathname.split('/').pop() ?? '';
  if (!ROOM_CODE.test(code)) throw new HttpError(400, 'invalid_code');
  await enforce(`rl:rooms-get:${clientIp(request)}`, 60, 60);
  const hostKey = await redis().get<string>(`room:${code}`);
  if (!hostKey) return json({ error: 'not_found' }, 404, { 'cache-control': 'no-store' });
  return json({ hostKey }, 200, { 'cache-control': 'no-store' });
});
