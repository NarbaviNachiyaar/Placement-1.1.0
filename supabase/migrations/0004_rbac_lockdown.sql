-- Run this in Supabase Dashboard → SQL Editor, AFTER 0001, 0002, 0003.
-- Phase 1 RBAC — database-level enforcement.
--
-- The app's UI now hides the Activity Log page from everyone except Super
-- Admin, but a hidden button is not real security: anyone with a valid
-- session could still call the Supabase REST API directly and read
-- activity_logs. This migration enforces the same rule at the database
-- level, so it holds even if the UI is bypassed.

-- Helper: is the current user a super_admin? Used in policies below.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

-- ── activity_logs: only Super Admin can read/update/delete. Anyone signed
--    in can still INSERT (every role's actions get logged), matching
--    "Only Super Admin can View Activity Logs / Audit Logs".
drop policy if exists "authenticated full access" on public.activity_logs;

drop policy if exists "anyone signed in can log activity" on public.activity_logs;
create policy "anyone signed in can log activity" on public.activity_logs
  for insert to authenticated with check (true);

drop policy if exists "only super admin reads activity" on public.activity_logs;
create policy "only super admin reads activity" on public.activity_logs
  for select to authenticated using (public.is_super_admin());

drop policy if exists "only super admin deletes activity" on public.activity_logs;
create policy "only super admin deletes activity" on public.activity_logs
  for delete to authenticated using (public.is_super_admin());

-- ── user_roles: only Super Admin can change roles (promote/demote/revoke).
--    Everyone can still read roles (needed to show labels/badges in the UI).
drop policy if exists "users read own role" on public.user_roles;
create policy "authenticated read roles" on public.user_roles
  for select to authenticated using (true);

drop policy if exists "only super admin manages roles" on public.user_roles;
create policy "only super admin manages roles" on public.user_roles
  for insert to authenticated with check (public.is_super_admin());

drop policy if exists "only super admin updates roles" on public.user_roles;
create policy "only super admin updates roles" on public.user_roles
  for update to authenticated using (public.is_super_admin());

drop policy if exists "only super admin deletes roles" on public.user_roles;
create policy "only super admin deletes roles" on public.user_roles
  for delete to authenticated using (public.is_super_admin());

-- ── approved_users: Admin can invite (insert), but only Super Admin can
--    deactivate/remove (update/delete) — matches "Admin: invite new users"
--    vs "Super Admin: remove team members".
drop policy if exists "admins manage approved_users" on public.approved_users;

drop policy if exists "managers invite approved users" on public.approved_users;
create policy "managers invite approved users" on public.approved_users
  for insert to authenticated with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role in ('super_admin', 'admin')
    )
  );

drop policy if exists "only super admin updates approved users" on public.approved_users;
create policy "only super admin updates approved users" on public.approved_users
  for update to authenticated using (public.is_super_admin());

drop policy if exists "only super admin deletes approved users" on public.approved_users;
create policy "only super admin deletes approved users" on public.approved_users
  for delete to authenticated using (public.is_super_admin());

grant execute on function public.is_super_admin() to authenticated, anon;
