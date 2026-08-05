-- Run in Supabase SQL Editor after previous migrations.
--
-- Supports the new self-healing logic in AuthProvider: if a signed-in
-- user's profile or role row is missing (e.g. their auth account existed
-- before profiles/user_roles did, so the auto-provision trigger never ran
-- for them), the app now creates it client-side instead of leaving them
-- stuck. That requires two narrowly-scoped policies:

-- Users can create their OWN profile row (not anyone else's).
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Users can create their OWN role row — but only if it matches the role
-- already on file for their email in approved_users. This is the
-- self-heal path, not a way to self-promote: a user cannot insert
-- 'super_admin' for themselves unless approved_users already says so.
drop policy if exists "users self-provision approved role" on public.user_roles;
create policy "users self-provision approved role" on public.user_roles
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = (
      select au.role from public.approved_users au
      join auth.users u on u.email = au.email
      where u.id = auth.uid()
      limit 1
    )
  );
