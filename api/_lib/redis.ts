import { Redis } from '@upstash/redis';
import { redisEnv } from './env.js';

let client: Redis | undefined;

export function redis(): Redis {
  const { url, token } = redisEnv(); // always validate so missing env is a 503, never a stale client
  client ??= new Redis({ url, token });
  return client;
}
