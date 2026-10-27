import { job } from '../_lib/job.js';

// Stub: records the run only. Future: build approved content.json and mark a content_releases row.
export default job('publish-content-release', async ({ body }) => ({
  stub: true,
  received: body !== null,
}));
