import { Client, Receiver } from '@upstash/qstash';
import { qstashEnv } from './env.js';

export type JobName =
  'transcode-recording' | 'notify-reviewers' | 'rollup-metrics' | 'publish-content-release';

/** Enqueue a job: QStash will POST the JSON body to `{origin}/api/jobs/{job}`. */
export async function publishJob(
  origin: string,
  job: JobName,
  body: Record<string, unknown>,
  opts: { deduplicationId?: string } = {},
): Promise<void> {
  const { token, baseUrl } = qstashEnv();
  const client = new Client({ token, ...(baseUrl ? { baseUrl } : {}) });
  await client.publishJSON({
    url: `${origin}/api/jobs/${job}`,
    body,
    retries: 3,
    ...(opts.deduplicationId ? { deduplicationId: opts.deduplicationId } : {}),
  });
}

/** Verify the `Upstash-Signature` header against the raw request body. */
export async function verifySignature(
  signature: string | null,
  rawBody: string,
  url: string,
): Promise<boolean> {
  const { currentSigningKey, nextSigningKey } = qstashEnv();
  if (!signature) return false;
  try {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    return await receiver.verify({ signature, body: rawBody, url });
  } catch {
    return false;
  }
}
