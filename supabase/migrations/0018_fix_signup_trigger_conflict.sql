-- Run in Supabase SQL Editor after previous migrations.
--
-- Bug: 500 error on /auth/v1/otp (and any new signup). The trigger that
-- auto-provisions a profile + role for a brand-new user still targeted
-- "on conflict (user_id, role)" — but 0015 replaced that composite unique
-- constraint with a unique constraint on user_id alone (to fix the role-
-- change bug). Since that old constraint no longer exists, the trigger
-- threw an error on every new signup, which Supabase Auth surfaces as a
-- 500 Internal Server Error.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  select role into assigned_role
  from public.approved_users
  where email = lower(new.email)
  limit 1;

  insert into public.profiles (id, email, full_name, last_login)
  values (new.id, new.email, split_part(new.email, '@', 1), now())
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, coalesce(assigned_role, 'viewer'))
  on conflict (user_id) do update set role = excluded.role;

  return new;
end;
$$;
