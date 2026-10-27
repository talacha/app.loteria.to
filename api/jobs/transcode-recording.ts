import { z } from 'zod';
import { job } from '../_lib/job.js';

const Body = z.object({ submissionId: z.uuid() });

// v1 stub: Vercel Functions have no ffmpeg. The browser already records webm/opus, so we only
// mark the upload as received and flag the transcode for a later worker (see docs/PLATFORM.md).
export default job('transcode-recording', async ({ sql, body }) => {
  const { submissionId } = Body.parse(body);
  const rows = await sql`update review_submissions
    set status = 'uploaded', updated_at = now()
    where id = ${submissionId} and status = 'upload_pending' returning id`;
  return { submissionId, updated: rows.length, transcode: 'transcode_pending' };
});
