import postgres from 'postgres';
import { dbEnv, supabaseEnv } from './env.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let sql: postgres.Sql | undefined;
let admin: SupabaseClient | undefined;

/** Pooled (transaction mode) Supabase Postgres. Prepared statements are unsupported there. */
export function db(): postgres.Sql {
  const { url: raw } = dbEnv();
  if (!sql) {
    const url = new URL(raw);
    // The Vercel integration appends a `supa=` marker the driver would send as a startup parameter.
    url.searchParams.delete('supa');
    sql = postgres(url.toString(), { prepare: false, max: 1, idle_timeout: 20, ssl: 'require' });
  }
  return sql;
}

export function supabaseAdmin(): SupabaseClient {
  const { url, serviceRoleKey } = supabaseEnv();
  if (!admin) {
    admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }
  return admin;
}
