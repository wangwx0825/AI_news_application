-- Company Wiki RLS policies
-- Run this in the Supabase SQL Editor after the tables exist.

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
drop policy if exists "Admins can read all faq" on public.faq;
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
drop policy if exists "Admins can delete admin users" on public.admin_users;
drop policy if exists "Admins can update admin users" on public.admin_users;

create policy "Admins can read admin users"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert admin users"
  on public.admin_users for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can delete admin users"
  on public.admin_users for delete
  to authenticated
  using (public.is_admin());

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
