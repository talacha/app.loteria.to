import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, supabaseAdmin } from '../_lib/db.js';
import { clientIp, enforce, HttpError, json, origin, parseBody, route } from '../_lib/http.js';
import { publishJob } from '../_lib/qstash.js';
import { verifyToken } from '../_lib/token.js';
import { LangSchema } from './auth.js';
import { CARD_IDS } from './cards.js';

const Body = z.object({
  lang: LangSchema,
  cardId: z.string().refine((id) => CARD_IDS.has(id), 'unknown_card'),
  text: z.string().min(1).max(500),
  ipa: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
  wantsUpload: z.boolean(),
  idempotencyKey: z.uuid(),
});

interface Row {
  id: string;
  audio_path: string | null;
}

async function signUpload(path: string) {
  const { data, error } = await supabaseAdmin()
    .storage.from('audio-pending')
    .createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(502, 'storage_error');
  return { signedUrl: data.signedUrl, token: data.token, path };
}

export default route(['POST'], async (request) => {
  const tokenLang = verifyToken(request);
  const body = await parseBody(request, Body);
  if (body.lang !== tokenLang) throw new HttpError(403, 'lang_mismatch');
  await enforce(`rl:review-submit:${clientIp(request)}`, 20, 600);

  const sql = db();
  const find = async () =>
    (
      await sql<Row[]>`select id, audio_path from review_submissions
        where idempotency_key = ${body.idempotencyKey}`
    )[0];
  const respondExisting = async (row: Row) =>
    json(
      { submissionId: row.id, upload: row.audio_path ? await signUpload(row.audio_path) : null },
      200,
    );

  const existing = await find();
  if (existing) return respondExisting(existing);

  const audioPath = body.wantsUpload ? `${body.lang}/${body.cardId}/${randomUUID()}.webm` : null;
  // Sign first: if Storage is down nothing is inserted and the client can simply retry.
  const upload = audioPath ? await signUpload(audioPath) : null;

  const inserted = await sql<Row[]>`insert into review_submissions
    (lang, card_id, text, ipa, note, status, audio_path, idempotency_key)
    values (${body.lang}, ${body.cardId}, ${body.text}, ${body.ipa ?? null}, ${body.note ?? null},
      ${audioPath ? 'upload_pending' : 'pending'}, ${audioPath}, ${body.idempotencyKey})
    on conflict (idempotency_key) do nothing
    returning id, audio_path`;
  const row = inserted[0];
  if (!row) {
    const raced = await find(); // lost a race with a duplicate request
    if (!raced) throw new HttpError(500, 'internal');
    return respondExisting(raced);
  }

  // The submission is durable; a missed notification must not fail the request.
  await publishJob(
    origin(request),
    'notify-reviewers',
    { submissionId: row.id },
    {
      deduplicationId: `notify-${row.id}`,
    },
  ).catch((err: unknown) => {
    console.error('enqueue_failed', 'notify-reviewers', err instanceof Error ? err.name : 'error');
  });
  return json({ submissionId: row.id, upload }, 201);
});
