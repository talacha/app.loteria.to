/** In-memory stand-ins for Upstash Redis, QStash, postgres and Supabase, used by api tests. */
export const redisStore = new Map<string, string | number>();
/** Expiry (seconds) passed with `set(..., { ex })`, by key. */
export const redisTtl = new Map<string, number>();
export const published: Array<{ url: string; body: unknown }> = [];
export const sqlCalls: string[] = [];
export const state = {
  receiverValid: true,
  /** Throw from any statement containing this text. */
  sqlFailOn: null as string | null,
  /** Rows returned for statements containing the key. */
  sqlRows: {} as Record<string, unknown[]>,
  objectExists: true,
  publishFails: false,
};

export function resetFakes(): void {
  redisStore.clear();
  redisTtl.clear();
  published.length = 0;
  sqlCalls.length = 0;
  state.receiverValid = true;
  state.sqlFailOn = null;
  state.sqlRows = {};
  state.objectExists = true;
  state.publishFails = false;
  clientOpts.length = 0;
}

/** A JWT-shaped Upstash-Signature carrying a jti (the fake Receiver does not check it). */
export function fakeSignature(jti: string): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256' })}.${b({ jti, iss: 'Upstash' })}.sig`;
}

export class FakeRedis {
  async set(
    key: string,
    value: string,
    opts?: { nx?: boolean; ex?: number },
  ): Promise<'OK' | null> {
    if (opts?.nx && redisStore.has(key)) return null;
    redisStore.set(key, value);
    if (opts?.ex !== undefined) redisTtl.set(key, opts.ex);
    return 'OK';
  }
  async get(key: string): Promise<string | number | null> {
    return redisStore.get(key) ?? null;
  }
  async del(key: string): Promise<number> {
    return redisStore.delete(key) ? 1 : 0;
  }
  multi() {
    let key = '';
    const chain = {
      incr(k: string) {
        key = k;
        return chain;
      },
      expire() {
        return chain;
      },
      async exec() {
        const n = Number(redisStore.get(key) ?? 0) + 1;
        redisStore.set(key, n);
        return [n, 1];
      },
    };
    return chain;
  }
  async ping(): Promise<string> {
    return 'PONG';
  }
}

export const clientOpts: unknown[] = [];

export class FakeQstashClient {
  constructor(opts: unknown) {
    clientOpts.push(opts);
  }
  async publishJSON(req: { url: string; body: unknown }): Promise<void> {
    if (state.publishFails) throw new Error('qstash down');
    published.push({ url: req.url, body: req.body });
  }
}

export class FakeReceiver {
  async verify(): Promise<boolean> {
    return state.receiverValid;
  }
}

/** postgres fake: tagged template records the statement; `sql(rows, ...cols)` passes through. */
export function fakeSql() {
  const fn = (strings: TemplateStringsArray | unknown): Promise<unknown[]> | unknown => {
    if (!Array.isArray(strings) || !('raw' in strings)) return strings;
    const text = (strings as TemplateStringsArray).join('?');
    sqlCalls.push(text);
    if (state.sqlFailOn && text.includes(state.sqlFailOn)) {
      return Promise.reject(new Error('db failure'));
    }
    const hit = Object.keys(state.sqlRows).find((k) => text.includes(k));
    return Promise.resolve(hit ? (state.sqlRows[hit] ?? []) : []);
  };
  return Object.assign(fn, { json: (v: unknown) => v });
}

export function fakeSupabaseClient() {
  return {
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({
          data: { signedUrl: `https://x.supabase.co/upload/${path}`, token: 'tok', path },
          error: null,
        }),
        exists: async () => ({ data: state.objectExists, error: null }),
      }),
    },
  };
}
