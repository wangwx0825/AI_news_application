-- Company Wiki database schema example
-- Run in the Supabase SQL Editor for a fresh project.

create extension if not exists pgcrypto;

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  summary text,
  content text,
  content_blocks jsonb default '[]'::jsonb,
  tags text[] default '{}',
  source text,
  source_url text,
  external_id text unique,
  author text,
  status text default '已发布',
  cover_image text,
  category text,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  slug text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null default 'cron',
  mode text not null default 'incremental',
  status text not null default 'success',
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null default 0,
  source_results jsonb not null default '{}'::jsonb,
  total_found integer not null default 0,
  inserted integer not null default 0,
  skipped integer not null default 0,
  error_count integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists news_published_at_idx
  on public.news (published_at desc nulls last);

create index if not exists news_source_idx
  on public.news (source);

create index if not exists faq_created_at_idx
  on public.faq (created_at desc);

create index if not exists import_runs_created_at_idx
  on public.import_runs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_news_updated_at on public.news;
create trigger set_news_updated_at
  before update on public.news
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_faq_updated_at on public.faq;
create trigger set_faq_updated_at
  before update on public.faq
  for each row
  execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where email = auth.jwt() ->> 'email'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.news enable row level security;
alter table public.faq enable row level security;
alter table public.admin_users enable row level security;
alter table public.import_runs enable row level security;

drop policy if exists "Allow public read access" on public.news;
drop policy if exists "Public can read published news" on public.news;
drop policy if exists "Admins can read all news" on public.news;
drop policy if exists "Admins can insert news" on public.news;
drop policy if exists "Admins can update news" on public.news;
drop policy if exists "Admins can delete news" on public.news;

create policy "Public can read published news"
  on public.news for select
  using (status is null or status = '已发布');

create policy "Admins can read all news"
  on public.news for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert news"
  on public.news for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update news"
  on public.news for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete news"
  on public.news for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Public can read faq" on public.faq;
drop policy if exists "Admins can insert faq" on public.faq;
drop policy if exists "Admins can update faq" on public.faq;
drop policy if exists "Admins can delete faq" on public.faq;

create policy "Public can read faq"
  on public.faq for select
  using (true);

create policy "Admins can insert faq"
  on public.faq for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update faq"
  on public.faq for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete faq"
  on public.faq for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read admin users" on public.admin_users;
drop policy if exists "Admins can insert admin users" on public.admin_users;
drop policy if exists "Admins can update admin users" on public.admin_users;
drop policy if exists "Admins can delete admin users" on public.admin_users;

create policy "Admins can read admin users"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert admin users"
  on public.admin_users for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update admin users"
  on public.admin_users for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read import runs" on public.import_runs;

create policy "Admins can read import runs"
  on public.import_runs for select
  to authenticated
  using (public.is_admin());

create policy "Admins can delete admin users"
  on public.admin_users for delete
  to authenticated
  using (public.is_admin());

-- Bootstrap the first admin before relying on the UI:
-- insert into public.admin_users (email) values ('your-admin@example.com')
-- on conflict (email) do nothing;
