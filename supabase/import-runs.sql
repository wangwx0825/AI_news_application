-- Import run logs table
-- Run this in the Supabase SQL Editor before using /admin/import-runs.

create extension if not exists pgcrypto;

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

create index if not exists import_runs_created_at_idx
  on public.import_runs (created_at desc);

alter table public.import_runs enable row level security;

drop policy if exists "Admins can read import runs" on public.import_runs;

create policy "Admins can read import runs"
  on public.import_runs for select
  to authenticated
  using (public.is_admin());
