export const ENV_KEYS = [
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'QSTASH_TOKEN',
  'QSTASH_URL',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'POSTGRES_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REVIEW_CODE',
  'PUBLIC_ORIGIN',
];

export function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

export function fullEnv(): void {
  Object.assign(process.env, {
    KV_REST_API_URL: 'https://redis.test',
    KV_REST_API_TOKEN: 't',
    QSTASH_TOKEN: 'q',
    QSTASH_CURRENT_SIGNING_KEY: 'current-signing-key',
    QSTASH_NEXT_SIGNING_KEY: 'next-signing-key',
    POSTGRES_URL: 'postgres://u:p@localhost:6543/db?supa=base-pooler.x',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'srk',
    REVIEW_CODE: 'sekret',
  });
}
