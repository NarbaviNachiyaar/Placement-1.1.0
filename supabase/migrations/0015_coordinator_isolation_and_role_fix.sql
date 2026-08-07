-- Run in Supabase SQL Editor after previous migrations.

-- ── #5 fix: "no unique or exclusion constraint matching ON CONFLICT" ───────
-- The app upserts role changes targeting a unique constraint on user_id
-- alone, but the table only had a composite unique(user_id, role) — so a
-- user could theoretically hold multiple role rows, and the upsert had
-- nothing matching to conflict against. A person should only ever have
-- one role. Dedupe any pre-existing duplicates, then make user_id unique.
delete from public.user_roles a using public.user_roles b
where a.user_id = b.user_id and a.ctid > b.ctid;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_roles_user_id_role_key'
  ) then
    alter table public.user_roles drop constraint user_roles_user_id_role_key;
  end if;
end $$;

alter table public.user_roles
  add constraint user_roles_user_id_key unique (user_id);

-- ── #1 / #2 / #3: company visibility redesign ──────────────────────────
-- super_admin / admin: see every company, fully.
-- coordinator: sees ONLY companies they are assigned to — not other
--   coordinators' assigned companies.
-- faculty / viewer: can browse the company list (name/industry/location/
--   status) but not notes or HR contacts (those stay locked down below).
drop policy if exists "everyone reads companies" on public.companies;
create policy "companies read scoped" on public.companies
  for select to authenticated using (
    public.is_admin_or_above()
    or public.current_role() in ('faculty', 'viewer')
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = companies.id and ca.user_id = auth.uid()
    )
  );

-- ── #2: notes — same scoping as HR contacts (0014). Only admin+ or a
--    coordinator assigned to that specific company. Faculty/viewer get
--    neither (browse-only per #3).
drop policy if exists "everyone reads notes" on public.notes;
drop policy if exists "notes read scoped" on public.notes;
create policy "notes read scoped" on public.notes
  for select to authenticated using (
    public.is_admin_or_above()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = notes.company_id and ca.user_id = auth.uid()
    )
  );

drop policy if exists "everyone creates notes" on public.notes;
drop policy if exists "notes write scoped" on public.notes;
create policy "notes write scoped" on public.notes
  for insert to authenticated with check (
    public.is_admin_or_above()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = notes.company_id and ca.user_id = auth.uid()
    )
  );

-- ── #14 security hardening: several tables were still wide open to ANY
--    signed-in user ("authenticated full access") and were never scoped
--    by later migrations. Closing those now.

-- follow-ups: same isolation as companies/notes/contacts — coordinators
-- only see follow-ups for companies they're assigned to.
drop policy if exists "everyone reads followups" on public.followups;
drop policy if exists "followups read scoped" on public.followups;
create policy "followups read scoped" on public.followups
  for select to authenticated using (
    public.is_admin_or_above()
    or public.current_role() in ('faculty', 'viewer')
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = followups.company_id and ca.user_id = auth.uid()
    )
  );

-- notifications: these are personal — nobody should be able to read or
-- modify someone else's. Anyone signed in can still create a notification
-- FOR another user (e.g. assigning them a task triggers one), but only the
-- recipient can read/update/delete their own.
drop policy if exists "authenticated full access" on public.notifications;
drop policy if exists "notifications insert any" on public.notifications;
create policy "notifications insert any" on public.notifications
  for insert to authenticated with check (true);

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- task_notes / task_attachments: scope to the same people who can see the
-- parent task (assigned_to, assigned_by, or admin+).
drop policy if exists "authenticated full access" on public.task_notes;
drop policy if exists "task_notes scoped" on public.task_notes;
create policy "task_notes scoped" on public.task_notes
  for all to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_notes.task_id
        and (public.is_admin_or_above() or t.assigned_to = auth.uid() or t.assigned_by = auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_notes.task_id
        and (public.is_admin_or_above() or t.assigned_to = auth.uid() or t.assigned_by = auth.uid())
    )
  );

drop policy if exists "authenticated full access" on public.task_attachments;
drop policy if exists "task_attachments scoped" on public.task_attachments;
create policy "task_attachments scoped" on public.task_attachments
  for all to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and (public.is_admin_or_above() or t.assigned_to = auth.uid() or t.assigned_by = auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and (public.is_admin_or_above() or t.assigned_to = auth.uid() or t.assigned_by = auth.uid())
    )
  );

-- company_assignments: who's assigned where shouldn't be freely readable/
-- writable by everyone either — only admin+ (who manage assignments) or
-- the assigned person themselves (read-only on their own row).
drop policy if exists "authenticated full access" on public.company_assignments;
drop policy if exists "company_assignments read scoped" on public.company_assignments;
create policy "company_assignments read scoped" on public.company_assignments
  for select to authenticated using (
    public.is_admin_or_above() or user_id = auth.uid()
  );

drop policy if exists "company_assignments write scoped" on public.company_assignments;
create policy "company_assignments write scoped" on public.company_assignments
  for insert to authenticated with check (public.is_admin_or_above());

drop policy if exists "company_assignments update scoped" on public.company_assignments;
create policy "company_assignments update scoped" on public.company_assignments
  for update to authenticated using (public.is_admin_or_above());

drop policy if exists "company_assignments delete scoped" on public.company_assignments;
create policy "company_assignments delete scoped" on public.company_assignments
  for delete to authenticated using (public.is_admin_or_above());
