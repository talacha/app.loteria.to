import { z } from 'zod';
import { db, supabaseAdmin } from '../_lib/db.js';
import { HttpError, json, origin, parseBody, route } from '../_lib/http.js';
import { publishJob } from '../_lib/qstash.js';
import { verifyToken } from '../_lib/token.js';

const Body = z.object({ submissionId: z.uuid() });

export default route(['POST'], async (request) => {
  const tokenLang = verifyToken(request);
  const { submissionId } = await parseBody(request, Body);
  const rows = await db()`select lang, status, audio_path from review_submissions
    where id = ${submissionId}`;
  const row = rows[0];
  if (!row || !row.audio_path) throw new HttpError(404, 'not_found');
  if (row.lang !== tokenLang) throw new HttpError(403, 'lang_mismatch');
  if (row.status !== 'upload_pending') throw new HttpError(409, 'bad_state');
  const { data, error } = await supabaseAdmin()
    .storage.from('audio-pending')
    .exists(row.audio_path);
  if (error) throw new HttpError(502, 'storage_error');
  if (!data) throw new HttpError(409, 'not_uploaded');
  await publishJob(
    origin(request),
    'transcode-recording',
    { submissionId },
    {
      deduplicationId: `transcode-${submissionId}`,
    },
  );
  return json({ ok: true }, 202);
});
