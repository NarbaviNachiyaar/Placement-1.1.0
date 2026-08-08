-- Run in Supabase SQL Editor after previous migrations.
--
-- Bug: "permission denied for table users". The self-heal policy added in
-- 0010 queried auth.users directly inside a regular RLS policy — regular
-- signed-in users (even Super Admins) can't read that protected table.
-- Since Postgres evaluates every INSERT policy on a table together, this
-- one broken policy caused ALL inserts to user_roles to fail — including
-- legitimate role changes by Super Admin.
--
-- Fix: move the auth.users lookup into a SECURITY DEFINER function (same
-- pattern already used successfully elsewhere), which is allowed to read
-- auth.users internally without needing the calling user to have that
-- permission themselves.

create or replace function public.get_own_approved_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.role
  from public.approved_users au
  join auth.users u on u.email = au.email
  where u.id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_own_approved_role() to authenticated;

drop policy if exists "users self-provision approved role" on public.user_roles;
create policy "users self-provision approved role" on public.user_roles
  for insert to authenticated with check (
    user_id = auth.uid() and role = public.get_own_approved_role()
  );
