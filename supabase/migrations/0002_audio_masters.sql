-- Private bucket for lossless WAV masters of the voice clips. Service role only:
-- storage.objects has RLS enabled and this migration adds NO policies for anon or authenticated,
-- so only the service role (which bypasses RLS) can read or write. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio-masters', 'audio-masters', false, 10485760, array['audio/wav', 'audio/x-wav'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;
