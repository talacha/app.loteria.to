import type { Sql } from 'postgres';
import { db } from './db.js';
import { qstashEnv } from './env.js';
import { route, json, HttpError, origin } from './http.js';
import { verifySignature } from './qstash.js';
import { redis } from './redis.js';

export interface JobContext {
  sql: Sql;
  body: unknown;
  messageId: string;
}

/** The signed `Upstash-Signature` is a JWT; its `jti` is unique per delivery attempt chain. */
export function signatureJti(signature: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(signature.split('.')[1] ?? '', 'base64url').toString());
    return typeof payload?.jti === 'string' && payload.jti ? payload.jti : null;
  } catch {
    return null;
  }
}

/**
 * QStash-driven job endpoint. Verifies the signature (bound to our public URL and the raw
 * body), takes a short Redis lease keyed by the signed jti, runs the job, records `job_runs`
 * and only then marks the key done. Any failure releases the lease and returns 5xx so QStash
 * retries.
 */
export function job(name: string, run: (ctx: JobContext) => Promise<Record<string, unknown>>) {
  return route(['POST'], async (request) => {
    qstashEnv(); // 503 before anything else if QStash is not configured
    const signature = request.headers.get('upstash-signature');
    if (!signature) throw new HttpError(400, 'missing_signature');
    const raw = await request.text();
    const url = `${origin(request)}/api/jobs/${name}`;
    if (!(await verifySignature(signature, raw, url)))
      throw new HttpError(401, 'invalid_signature');
    const messageId = signatureJti(signature);
    if (!messageId) throw new HttpError(400, 'missing_jti');

    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new HttpError(400, 'invalid_json');
    }
    const sql = db(); // 503 before taking the lease if the database is not configured

    const r = redis();
    const key = `job:${messageId}`;
    const leased = await r.set(key, 'running', { nx: true, ex: 120 });
    if (leased === null) {
      if ((await r.get(key)) === 'done') return json({ status: 'duplicate' });
      throw new HttpError(409, 'in_progress'); // another delivery is running: retry later
    }

    try {
      const detail = await run({ sql, body, messageId });
      await sql`insert into job_runs (job, message_id, status, detail)
        values (${name}, ${messageId}, 'ok', ${sql.json(detail as never)})`;
      await r.set(key, 'done', { ex: 86400 });
      return json({ status: 'ok', ...detail });
    } catch (err) {
      await r.del(key).catch(() => undefined); // release the lease so the retry can run
      await sql`insert into job_runs (job, message_id, status, detail)
        values (${name}, ${messageId}, 'error', ${sql.json({ error: err instanceof Error ? err.name : 'error' })})`.catch(
        () => undefined,
      );
      throw err;
    }
  });
}
