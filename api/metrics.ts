import { z } from 'zod';
import { db } from './_lib/db.js';
import { NotConfigured } from './_lib/env.js';
import { clientIp, enforce, json, noContent, parseBody, route } from './_lib/http.js';

const Body = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(['round_start', 'card_matched', 'claim', 'round_end', 'print']),
        n: z.number().int().min(1).max(10).optional(),
      }),
    )
    .min(1)
    .max(50)
    .refine((events) => events.reduce((sum, e) => sum + (e.n ?? 1), 0) <= 200),
});

export default route(['POST'], async (request) => {
  // Respect Do Not Track / Global Privacy Control: store nothing.
  if (request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1') {
    return noContent();
  }
  const { events } = await parseBody(request, Body);
  try {
    await enforce(`rl:metrics:${clientIp(request)}`, 30, 60);
  } catch (err) {
    if (!(err instanceof NotConfigured)) throw err; // metrics are optional: no Redis, no limit
  }
  const sql = db();
  const rows = events.map((e) => ({ name: e.name, n: e.n ?? 1 }));
  await sql`insert into metric_events ${sql(rows, 'name', 'n')}`;
  return json({ ok: true, stored: rows.length }, 202);
});
