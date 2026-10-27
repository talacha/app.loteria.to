import { dbEnv, qstashEnv, redisEnv } from './_lib/env.js';
import { db } from './_lib/db.js';
import { json, route } from './_lib/http.js';
import { redis } from './_lib/redis.js';

type Status = 'ok' | 'not_configured' | 'error';

async function check(configured: () => unknown, ping: () => Promise<unknown>): Promise<Status> {
  try {
    configured();
  } catch {
    return 'not_configured';
  }
  try {
    await ping();
    return 'ok';
  } catch {
    return 'error';
  }
}

export default route(['GET'], async () => {
  const [r, d] = await Promise.all([
    check(redisEnv, () => redis().ping()),
    check(dbEnv, async () => db()`select 1`),
  ]);
  // QStash has no cheap authenticated ping; configured means all three secrets are present.
  let q: Status = 'ok';
  try {
    qstashEnv();
  } catch {
    q = 'not_configured';
  }
  return json({ redis: r, qstash: q, db: d }, 200, { 'cache-control': 'no-store' });
});
