import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEnv, fullEnv } from './setup.js';
import {
  clientOpts,
  fakeSignature,
  published,
  redisStore,
  resetFakes,
  sqlCalls,
  state,
} from './fakes.js';

vi.mock('@upstash/redis', async () => ({ Redis: (await import('./fakes.js')).FakeRedis }));
vi.mock('@upstash/qstash', async () => {
  const f = await import('./fakes.js');
  return { Client: f.FakeQstashClient, Receiver: f.FakeReceiver };
});
vi.mock('postgres', async () => ({ default: (await import('./fakes.js')).fakeSql }));
vi.mock('@supabase/supabase-js', async () => ({
  createClient: (await import('./fakes.js')).fakeSupabaseClient,
}));

const URL_BASE = 'https://app.loteria.to';
const HOST_KEY = 'A'.repeat(90);
const read = async (r: Response) => (await r.json()) as Record<string, unknown>;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${URL_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '1.2.3.4', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.useRealTimers();
  resetFakes();
  clearEnv();
  fullEnv();
});

describe('rooms', () => {
  it('creates a room, is idempotent for the same key (200) and 409s for a different one', async () => {
    const { default: h } = await import('../../api/rooms/index.js');
    const body = { code: 'ABCD2', hostKey: HOST_KEY };
    expect((await h.fetch(post('/api/rooms', body))).status).toBe(201);
    expect((await h.fetch(post('/api/rooms', body))).status).toBe(200);
    const clash = await h.fetch(post('/api/rooms', { ...body, hostKey: 'B'.repeat(90) }));
    expect(clash.status).toBe(409);
    expect(await read(clash)).toEqual({ error: 'code_taken' });
  });

  it('rejects bad codes and out-of-range host keys', async () => {
    const { default: h } = await import('../../api/rooms/index.js');
    for (const code of ['ABCD', 'ABCDEF', 'ABCI2', 'ABCO2', 'ABCL2', 'abcd2', 'ABC01']) {
      expect((await h.fetch(post('/api/rooms', { code, hostKey: HOST_KEY }))).status, code).toBe(
        400,
      );
    }
    for (const hostKey of ['short', 'A'.repeat(129), 'A'.repeat(90) + '+']) {
      expect((await h.fetch(post('/api/rooms', { code: 'ABCD2', hostKey }))).status).toBe(400);
    }
  });

  it('rate limits at 10 per minute per IP with Retry-After', async () => {
    const { default: h } = await import('../../api/rooms/index.js');
    const statuses: number[] = [];
    let last: Response | undefined;
    for (const c of 'ABCDEFGHJKM'.split('')) {
      last = await h.fetch(post('/api/rooms', { code: `${c}2345`, hostKey: HOST_KEY }));
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(last?.headers.get('retry-after')).toBe('60');
  });

  it('GET returns hostKey or 404 with no-store', async () => {
    const { default: h } = await import('../../api/rooms/[code].js');
    const get = (c: string) => h.fetch(new Request(`${URL_BASE}/api/rooms/${c}`));
    expect((await get('ABCD2')).status).toBe(404);
    redisStore.set('room:ABCD2', 'hk');
    const ok = await get('ABCD2');
    expect(await read(ok)).toEqual({ hostKey: 'hk' });
    expect(ok.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses cross-origin requests and lists allowed methods on 405', async () => {
    const { default: h } = await import('../../api/rooms/index.js');
    const res = await h.fetch(
      post('/api/rooms', { code: 'ABCD2', hostKey: HOST_KEY }, { origin: 'https://evil.example' }),
    );
    expect(res.status).toBe(403);
    const bad = await h.fetch(new Request(`${URL_BASE}/api/rooms`));
    expect(bad.status).toBe(405);
    expect(bad.headers.get('allow')).toBe('POST');
  });
});

describe('missing env', () => {
  it('returns 503 JSON when Redis is not configured', async () => {
    clearEnv();
    const { default: h } = await import('../../api/rooms/index.js');
    const res = await h.fetch(post('/api/rooms', { code: 'ABCD2', hostKey: HOST_KEY }));
    expect(res.status).toBe(503);
    expect(await read(res)).toEqual({ error: 'not_configured', feature: 'redis' });
  });

  it('accepts the Upstash-named env vars too', async () => {
    clearEnv();
    process.env.UPSTASH_REDIS_REST_URL = 'https://r';
    process.env.UPSTASH_REDIS_REST_TOKEN = 't';
    const { default: h } = await import('../../api/rooms/index.js');
    expect((await h.fetch(post('/api/rooms', { code: 'ABCD2', hostKey: HOST_KEY }))).status).toBe(
      201,
    );
  });

  it('health reports not_configured without throwing', async () => {
    clearEnv();
    const { default: h } = await import('../../api/health.js');
    const res = await h.fetch(new Request(`${URL_BASE}/api/health`));
    expect(await read(res)).toEqual({
      redis: 'not_configured',
      qstash: 'not_configured',
      db: 'not_configured',
    });
  });
});

describe('jobs', () => {
  const jobReq = (jti = 'm1', headers: Record<string, string> = {}) =>
    post('/api/jobs/rollup-metrics', {}, { 'upstash-signature': fakeSignature(jti), ...headers });

  it('401 on bad signature, 400 when the header is missing', async () => {
    const { default: h } = await import('../../api/jobs/rollup-metrics.js');
    state.receiverValid = false;
    expect((await h.fetch(jobReq())).status).toBe(401);
    expect(sqlCalls).toHaveLength(0);
    state.receiverValid = true;
    expect((await h.fetch(post('/api/jobs/rollup-metrics', {}))).status).toBe(400);
  });

  it('400 when the signature has no jti (no Date.now fallback)', async () => {
    const { default: h } = await import('../../api/jobs/rollup-metrics.js');
    const res = await h.fetch(
      post('/api/jobs/rollup-metrics', {}, { 'upstash-signature': 'a.b.c' }),
    );
    expect(res.status).toBe(400);
  });

  it('503 when QStash is not configured', async () => {
    delete process.env.QSTASH_TOKEN;
    const { default: h } = await import('../../api/jobs/rollup-metrics.js');
    expect((await h.fetch(jobReq())).status).toBe(503);
  });

  it('runs once per jti, records job_runs and marks the key done', async () => {
    const { default: h } = await import('../../api/jobs/rollup-metrics.js');
    expect((await read(await h.fetch(jobReq()))).status).toBe('ok');
    expect(redisStore.get('job:m1')).toBe('done');
    expect((await read(await h.fetch(jobReq()))).status).toBe('duplicate');
    expect(sqlCalls.filter((s) => s.includes("'ok'"))).toHaveLength(1);
  });

  it('a failed run releases the lease, returns 5xx and the retry runs again', async () => {
    const { default: h } = await import('../../api/jobs/rollup-metrics.js');
    state.sqlFailOn = 'insert into metric_daily';
    const failed = await h.fetch(jobReq());
    expect(failed.status).toBe(500);
    expect(redisStore.has('job:m1')).toBe(false);
    state.sqlFailOn = null;
    expect((await read(await h.fetch(jobReq()))).status).toBe('ok');
  });

  it('an in-flight lease yields 409 so QStash retries later', async () => {
    const { default: h } = await import('../../api/jobs/rollup-metrics.js');
    redisStore.set('job:m1', 'running');
    expect((await h.fetch(jobReq())).status).toBe(409);
  });

  it('transcode only touches rows in upload_pending', async () => {
    const { default: h } = await import('../../api/jobs/transcode-recording.js');
    const id = crypto.randomUUID();
    const res = await h.fetch(
      post(
        '/api/jobs/transcode-recording',
        { submissionId: id },
        { 'upstash-signature': fakeSignature('t1') },
      ),
    );
    expect(res.status).toBe(200);
    expect(sqlCalls.some((s) => s.includes("status = 'upload_pending'"))).toBe(true);
  });
});

describe('review', () => {
  const auth = async (lang = 'nah') => {
    const { default: a } = await import('../../api/review/auth.js');
    return a.fetch(post('/api/review/auth', { lang, code: 'sekret' }));
  };
  const tokenFor = async (lang = 'nah') => (await read(await auth(lang))).token as string;
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const submission = (over: Record<string, unknown> = {}) => ({
    lang: 'nah',
    cardId: 'jaguar',
    text: 'ocelotl',
    wantsUpload: false,
    idempotencyKey: crypto.randomUUID(),
    ...over,
  });

  it('locks out after 5 failures per IP, counting only failures', async () => {
    const { default: a } = await import('../../api/review/auth.js');
    expect((await auth()).status).toBe(200);
    expect((await auth()).status).toBe(200); // successes do not consume the budget
    const bad = () => a.fetch(post('/api/review/auth', { lang: 'nah', code: 'nope' }));
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await bad()).status);
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
    const locked = await auth();
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBe('600');
  });

  it('applies a global failure budget across IPs', async () => {
    const { default: a } = await import('../../api/review/auth.js');
    redisStore.set('rl:review-auth:global', 50);
    const res = await a.fetch(
      post('/api/review/auth', { lang: 'nah', code: 'nope' }, { 'x-real-ip': '9.9.9.9' }),
    );
    expect(res.status).toBe(429);
  });

  it('prefers platform IP headers and never trusts the first XFF hop', async () => {
    const { clientIp } = await import('../../api/_lib/http.js');
    const req = (h: Record<string, string>) => new Request(URL_BASE, { headers: h });
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }))).toBe('7.7.7.7');
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '5.5.5.5' }))).toBe('5.5.5.5');
    expect(clientIp(req({ 'x-vercel-forwarded-for': '4.4.4.4', 'x-real-ip': '5.5.5.5' }))).toBe(
      '4.4.4.4',
    );
    expect(clientIp(req({ 'x-real-ip': '2001:db8:1:2:aaaa:bbbb:cccc:dddd' }))).toBe(
      '2001:db8:1:2::/64',
    );
  });

  it('submit: missing, tampered and expired tokens are 401; wrong-lang token is 403', async () => {
    const { default: submit } = await import('../../api/review/submit.js');
    const go = (token?: string, body = submission()) =>
      submit.fetch(post('/api/review/submit', body, token ? bearer(token) : {}));
    expect((await go()).status).toBe(401);

    const token = await tokenFor();
    const [payload, sig] = token.split('.') as [string, string];
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        exp: 9999999999,
      }),
    ).toString('base64url');
    expect((await go(`${forged}.${sig}`)).status).toBe(401);
    expect((await go(`${payload}.${sig.slice(0, -2)}xx`)).status).toBe(401);

    expect((await go(await tokenFor('es'))).status).toBe(403);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000 + 5000);
    const expired = await go(token);
    expect(expired.status).toBe(401);
    expect(await read(expired)).toEqual({ error: 'token_expired' });
  });

  it('submit validates card ids against the real deck', async () => {
    const { default: submit } = await import('../../api/review/submit.js');
    const token = await tokenFor();
    const res = await submit.fetch(
      post('/api/review/submit', submission({ cardId: 'nope' }), bearer(token)),
    );
    expect(res.status).toBe(400);
  });

  it('submit is idempotent on idempotencyKey and a failed enqueue does not fail it', async () => {
    const { default: submit } = await import('../../api/review/submit.js');
    const token = await tokenFor();
    const body = submission({ wantsUpload: true });
    state.publishFails = true;
    state.sqlRows['insert into review_submissions'] = [
      { id: 'sub-1', audio_path: 'nah/jaguar/x.webm' },
    ];
    const first = await submit.fetch(post('/api/review/submit', body, bearer(token)));
    expect(first.status).toBe(201);
    const data = await read(first);
    expect(data.submissionId).toBe('sub-1');
    expect((data.upload as { path: string }).path).toMatch(/^nah\/jaguar\/.+\.webm$/);

    // second call finds the existing row: 200, no enqueue
    state.sqlRows['from review_submissions'] = [{ id: 'sub-1', audio_path: 'nah/jaguar/x.webm' }];
    const again = await submit.fetch(post('/api/review/submit', body, bearer(token)));
    expect(again.status).toBe(200);
    expect(published).toHaveLength(0);
  });

  it('uploaded flow: enqueues only for upload_pending rows whose object exists', async () => {
    const { default: uploaded } = await import('../../api/review/uploaded.js');
    const token = await tokenFor();
    const id = crypto.randomUUID();
    const go = () =>
      uploaded.fetch(post('/api/review/uploaded', { submissionId: id }, bearer(token)));

    expect((await go()).status).toBe(404);

    state.sqlRows['from review_submissions'] = [
      { lang: 'nah', status: 'uploaded', audio_path: 'p.webm' },
    ];
    expect((await go()).status).toBe(409);

    state.sqlRows['from review_submissions'] = [
      { lang: 'nah', status: 'upload_pending', audio_path: 'p.webm' },
    ];
    state.objectExists = false;
    expect(await read(await go())).toEqual({ error: 'not_uploaded' });
    expect(published).toHaveLength(0);

    state.objectExists = true;
    expect((await go()).status).toBe(202);
    expect(published[0]?.url).toBe(`${URL_BASE}/api/jobs/transcode-recording`);

    state.sqlRows['from review_submissions'] = [
      { lang: 'es', status: 'upload_pending', audio_path: 'p.webm' },
    ];
    expect((await go()).status).toBe(403);
  });
});

describe('qstash client', () => {
  it('passes QSTASH_URL as baseUrl for regional accounts, omits it otherwise', async () => {
    const { publishJob } = await import('../../api/_lib/qstash.js');
    process.env.QSTASH_URL = 'https://qstash-eu-central-1.upstash.io/';
    await publishJob(URL_BASE, 'notify-reviewers', {});
    expect(clientOpts[0]).toMatchObject({ baseUrl: 'https://qstash-eu-central-1.upstash.io' });
    delete process.env.QSTASH_URL;
    await publishJob(URL_BASE, 'notify-reviewers', {});
    expect(clientOpts[1]).not.toHaveProperty('baseUrl');
  });
});

describe('metrics', () => {
  const ev = { events: [{ name: 'claim' }, { name: 'print', n: 3 }] };

  it('returns 204 and stores nothing for Sec-GPC: 1 or DNT: 1', async () => {
    const { default: h } = await import('../../api/metrics.js');
    expect((await h.fetch(post('/api/metrics', ev, { 'sec-gpc': '1' }))).status).toBe(204);
    expect((await h.fetch(post('/api/metrics', ev, { dnt: '1' }))).status).toBe(204);
    expect(sqlCalls).toHaveLength(0);
  });

  it('rejects unknown names, n > 10 and totals above 200', async () => {
    const { default: h } = await import('../../api/metrics.js');
    expect((await h.fetch(post('/api/metrics', { events: [{ name: 'pii' }] }))).status).toBe(400);
    expect(
      (await h.fetch(post('/api/metrics', { events: [{ name: 'claim', n: 11 }] }))).status,
    ).toBe(400);
    const big = { events: Array.from({ length: 30 }, () => ({ name: 'claim', n: 10 })) };
    expect((await h.fetch(post('/api/metrics', big))).status).toBe(400);
  });

  it('limits to 30 requests per minute per IP', async () => {
    const { default: h } = await import('../../api/metrics.js');
    let last = 202;
    for (let i = 0; i < 31; i++) last = (await h.fetch(post('/api/metrics', ev))).status;
    expect(last).toBe(429);
  });
});
