-- Run in Supabase SQL Editor after previous migrations.
--
-- Correction: Faculty should be strictly VIEW-ONLY across companies,
-- notes, follow-ups, and HR contacts — including their own previously-
-- created records. 0017 allowed Faculty to edit their own work; this
-- migration removes that and restricts every write path to
-- super_admin/admin only. Faculty's READ access is unchanged (they can
-- still see everything, just never edit/create/delete).

-- ── companies ────────────────────────────────────────────────────────────
drop policy if exists "companies insert scoped" on public.companies;
create policy "companies insert scoped" on public.companies
  for insert to authenticated with check (
    public.current_role() in ('super_admin', 'admin')
  );

drop policy if exists "companies update scoped" on public.companies;
create policy "companies update scoped" on public.companies
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin')
  );

-- ── notes ────────────────────────────────────────────────────────────────
drop policy if exists "notes insert scoped" on public.notes;
create policy "notes insert scoped" on public.notes
  for insert to authenticated with check (
    public.current_role() in ('super_admin', 'admin')
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = notes.company_id and ca.user_id = auth.uid()
    )
  );

drop policy if exists "notes update scoped" on public.notes;
create policy "notes update scoped" on public.notes
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or (created_by = auth.uid() and public.current_role() = 'coordinator')
  );

drop policy if exists "notes delete scoped" on public.notes;
create policy "notes delete scoped" on public.notes
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or (created_by = auth.uid() and public.current_role() = 'coordinator')
  );

-- ── followups ────────────────────────────────────────────────────────────
drop policy if exists "followups insert scoped" on public.followups;
create policy "followups insert scoped" on public.followups
  for insert to authenticated with check (
    public.current_role() in ('super_admin', 'admin')
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = followups.company_id and ca.user_id = auth.uid()
    )
  );

drop policy if exists "followups update scoped" on public.followups;
create policy "followups update scoped" on public.followups
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or (public.current_role() = 'coordinator' and (created_by = auth.uid() or assigned_to = auth.uid()))
  );

drop policy if exists "followups delete scoped" on public.followups;
create policy "followups delete scoped" on public.followups
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or (public.current_role() = 'coordinator' and (created_by = auth.uid() or assigned_to = auth.uid()))
  );

-- ── contacts (HR details) ───────────────────────────────────────────────
drop policy if exists "contacts write access" on public.contacts;
create policy "contacts write access" on public.contacts
  for all to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or (
      public.current_role() = 'coordinator'
      and exists (
        select 1 from public.company_assignments ca
        where ca.company_id = contacts.company_id and ca.user_id = auth.uid()
      )
    )
  ) with check (
    public.current_role() in ('super_admin', 'admin')
    or (
      public.current_role() = 'coordinator'
      and exists (
        select 1 from public.company_assignments ca
        where ca.company_id = contacts.company_id and ca.user_id = auth.uid()
      )
    )
  );

-- ── tasks: Faculty can still SEE every task (unchanged), but can no
--    longer create, assign, edit, or review any task — matching the
--    "Task Assignment ❌" rule for Faculty in the permission matrix.
drop policy if exists "admin+ assigns tasks" on public.tasks;
create policy "admin+ assigns tasks" on public.tasks
  for insert to authenticated with check (
    public.current_role() in ('super_admin', 'admin') or assigned_to = auth.uid()
  );

drop policy if exists "own task or admin updates" on public.tasks;
create policy "own task or admin updates" on public.tasks
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin') or assigned_to = auth.uid()
  );

drop policy if exists "own task or admin deletes" on public.tasks;
create policy "own task or admin deletes" on public.tasks
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin') or assigned_to = auth.uid()
  );
