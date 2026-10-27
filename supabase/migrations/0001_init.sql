-- Lotería de los Pueblos: platform schema. Service role only (RLS on, no anon/authenticated policies).
-- Idempotent: safe to re-run.

create table if not exists public.reviewers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  langs text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid unique,
  lang text not null check (lang in ('es', 'en', 'nah', 'yua', 'quz')),
  card_id text not null check (card_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  text text not null check (char_length(text) between 1 and 500),
  ipa text check (char_length(ipa) <= 500),
  note text check (char_length(note) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'upload_pending', 'uploaded', 'approved', 'rejected')),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_submissions_status_idx
  on public.review_submissions (status, created_at);
create index if not exists review_submissions_card_idx on public.review_submissions (lang, card_id);

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists review_submissions_set_updated_at on public.review_submissions;
create trigger review_submissions_set_updated_at
  before update on public.review_submissions
  for each row execute function public.set_updated_at();

create table if not exists public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.review_submissions (id) on delete cascade,
  reviewer_id uuid references public.reviewers (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'needs_changes')),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists review_decisions_submission_idx
  on public.review_decisions (submission_id);

create table if not exists public.content_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  notes text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.metric_events (
  id bigint generated always as identity primary key,
  name text not null check (name in ('round_start', 'card_matched', 'claim', 'round_end', 'print')),
  n integer not null default 1 check (n between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists metric_events_created_idx on public.metric_events (created_at);

create table if not exists public.metric_daily (
  day date not null,
  name text not null,
  total bigint not null,
  primary key (day, name)
);

create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  message_id text,
  status text not null check (status in ('ok', 'error')),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists job_runs_job_idx on public.job_runs (job, created_at desc);

alter table public.reviewers enable row level security;
alter table public.review_submissions enable row level security;
alter table public.review_decisions enable row level security;
alter table public.content_releases enable row level security;
alter table public.metric_events enable row level security;
alter table public.metric_daily enable row level security;
alter table public.job_runs enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS) can read or write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-pending', 'audio-pending', false, 5242880,
  array['audio/webm', 'audio/ogg', 'audio/mp4']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
