import { job } from '../_lib/job.js';

const RETENTION_DAYS = 30;

export default job('rollup-metrics', async ({ sql }) => {
  // Recompute whole UTC days still present in raw (idempotent), up to but excluding today.
  const rolled = await sql`
    insert into metric_daily (day, name, total)
    select (created_at at time zone 'utc')::date, name, sum(n)
    from metric_events
    where created_at >= date_trunc('day', now() at time zone 'utc') - make_interval(days => ${RETENTION_DAYS})
      and created_at < date_trunc('day', now() at time zone 'utc')
    group by 1, 2
    on conflict (day, name) do update set total = excluded.total
    returning day`;
  const deleted = await sql`
    delete from metric_events
    where created_at < date_trunc('day', now() at time zone 'utc') - make_interval(days => ${RETENTION_DAYS})
    returning id`;
  return { rolledRows: rolled.length, deletedRaw: deleted.length };
});
