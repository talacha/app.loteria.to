import { job } from '../_lib/job.js';

// Stub: no email provider yet. The job_runs row is the audit trail.
export default job('notify-reviewers', async ({ body }) => ({
  stub: true,
  received: body !== null,
}));
