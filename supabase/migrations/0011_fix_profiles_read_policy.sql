-- Run in Supabase SQL Editor after previous migrations.
--
-- Bug: profiles' SELECT policy only allowed auth.uid() = id — meaning each
-- person could only ever see their OWN profile row, never their
-- teammates'. That's why the Team page's "Members" list appeared empty or
-- missing people even though they'd successfully signed in — the database
-- was silently filtering every other row out.

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "authenticated read all profiles" on public.profiles;
create policy "authenticated read all profiles" on public.profiles
  for select to authenticated using (true);

-- Keep updates scoped to your own profile only (unchanged, still correct).
