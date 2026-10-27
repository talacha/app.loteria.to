import { z } from 'zod';

/** Thrown when an optional backing service has no credentials; handlers map it to 503. */
export class NotConfigured extends Error {
  readonly feature: string;
  constructor(feature: string) {
    super(`${feature} is not configured`);
    this.name = 'NotConfigured';
    this.feature = feature;
  }
}

const nonEmpty = z.string().min(1);

function read<T extends z.ZodType>(feature: string, schema: T, raw: unknown): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new NotConfigured(feature);
  return parsed.data;
}

const env = (): NodeJS.ProcessEnv => process.env;

export function redisEnv(): { url: string; token: string } {
  const e = env();
  return read('redis', z.object({ url: nonEmpty, token: nonEmpty }), {
    url: e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL,
    token: e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN,
  });
}

export function qstashEnv(): {
  token: string;
  currentSigningKey: string;
  nextSigningKey: string;
  baseUrl?: string;
} {
  const e = env();
  const base = read(
    'qstash',
    z.object({ token: nonEmpty, currentSigningKey: nonEmpty, nextSigningKey: nonEmpty }),
    {
      token: e.QSTASH_TOKEN,
      currentSigningKey: e.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: e.QSTASH_NEXT_SIGNING_KEY,
    },
  );
  // Regional accounts (e.g. https://qstash-eu-central-1.upstash.io) must publish to their own endpoint.
  const baseUrl = z.url().safeParse(e.QSTASH_URL);
  return baseUrl.success ? { ...base, baseUrl: baseUrl.data.replace(/\/+$/, '') } : base;
}

export function dbEnv(): { url: string } {
  return read('db', z.object({ url: nonEmpty }), { url: env().POSTGRES_URL });
}

export function supabaseEnv(): { url: string; serviceRoleKey: string } {
  const e = env();
  return read('supabase', z.object({ url: nonEmpty, serviceRoleKey: nonEmpty }), {
    url: e.SUPABASE_URL,
    serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function reviewCode(): string {
  return read('review', nonEmpty, env().REVIEW_CODE);
}

export function adminCode(): string {
  return read('admin', nonEmpty, env().ADMIN_CODE);
}

/** Canonical public origin (e.g. https://app.loteria.to); optional, falls back to the request. */
export function publicOrigin(): string | undefined {
  const v = process.env.PUBLIC_ORIGIN;
  return v ? v.replace(/\/+$/, '') : undefined;
}
