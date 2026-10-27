import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redisStore, resetFakes } from './fakes.js';
import { clearEnv, fullEnv } from './setup.js';

// Real @upstash/qstash Receiver; only Redis and postgres are faked.
vi.mock('@upstash/redis', async () => ({ Redis: (await import('./fakes.js')).FakeRedis }));
vi.mock('postgres', async () => ({ default: (await import('./fakes.js')).fakeSql }));

const URL_FULL = 'https://app.loteria.to/api/jobs/rollup-metrics';
const BODY = JSON.stringify({ hello: 'world' });
const KEY = 'current-signing-key';

async function sign(opts: { body?: string; sub?: string; key?: string; jti?: string } = {}) {
  const hash = createHash('sha256')
    .update(opts.body ?? BODY)
    .digest('base64url');
  return new SignJWT({ body: hash })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('Upstash')
    .setSubject(opts.sub ?? URL_FULL)
    .setJti(opts.jti ?? 'msg_1')
    .setIssuedAt()
    .setNotBefore('0s')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(opts.key ?? KEY));
}

const call = async (signature: string, body = BODY, url = URL_FULL) => {
  const { default: h } = await import('../../api/jobs/rollup-metrics.js');
  return h.fetch(
    new Request(url, { method: 'POST', body, headers: { 'upstash-signature': signature } }),
  );
};

beforeEach(() => {
  resetFakes();
  clearEnv();
  fullEnv();
});

describe('QStash signature (real Receiver)', () => {
  it('accepts a correctly signed request and uses the jti as the idempotency key', async () => {
    expect((await call(await sign())).status).toBe(200);
    expect(redisStore.get('job:msg_1')).toBe('done');
  });

  it('accepts a signature made with the next signing key', async () => {
    expect((await call(await sign({ key: 'next-signing-key' }))).status).toBe(200);
  });

  it('rejects a body that does not match the signed hash', async () => {
    expect((await call(await sign(), '{"hello":"tampered"}')).status).toBe(401);
  });

  it('rejects a subject (URL) mismatch, including another job path', async () => {
    const sig = await sign({ sub: 'https://app.loteria.to/api/jobs/notify-reviewers' });
    expect((await call(sig)).status).toBe(401);
  });

  it('rejects a signature from the wrong key', async () => {
    expect((await call(await sign({ key: 'attacker' }))).status).toBe(401);
  });

  it('verifies against PUBLIC_ORIGIN when set, not the request host', async () => {
    process.env.PUBLIC_ORIGIN = 'https://app.loteria.to';
    const internal = 'https://internal-host.vercel.app/api/jobs/rollup-metrics';
    expect((await call(await sign(), BODY, internal)).status).toBe(200);
  });
});
