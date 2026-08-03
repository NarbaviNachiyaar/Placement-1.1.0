-- Run this in Supabase Dashboard → SQL Editor.
-- Fixes: "permission denied for table approved_users" (error 42501).
--
-- RLS policies control WHICH ROWS a role can see, but Postgres also needs a
-- table-level GRANT before a role can touch the table at all. We had RLS
-- policies but never ran the GRANTs — this adds them for every table the
-- app uses.

grant usage on schema public to anon, authenticated;

-- Auth-gate table: anon needs SELECT to check approval before sign-in.
grant select on public.approved_users to anon;
grant select, insert, update, delete on public.approved_users to authenticated;

-- Everything else only needs to work for signed-in (authenticated) users.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.company_assignments to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.followups to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_notes to authenticated;
grant select, insert, update, delete on public.task_attachments to authenticated;
grant select, insert, update, delete on public.activity_logs to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

-- Profiles/roles are read at sign-in time too (before full session in some
-- flows) — grant anon SELECT here as well so profile/role lookups don't
-- silently fail during the auth handshake.
grant select on public.profiles to anon;
grant select on public.user_roles to anon;
