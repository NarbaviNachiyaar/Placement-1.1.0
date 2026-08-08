-- Run in Supabase SQL Editor after previous migrations.
--
-- We've iterated on companies/notes/followups policies several times across
-- earlier migrations, and restrictions haven't reliably taken effect —
-- most likely because an old, more permissive policy from an earlier
-- migration was never actually cleared (Postgres OR's every matching
-- policy together, so one leftover permissive policy silently overrides a
-- newer, stricter one). This migration explicitly drops every policy name
-- ever used on these four tables across all prior migrations, then
-- rebuilds the definitive, final version in one place.
--
-- Final rules:
--   Company/note/follow-up VISIBILITY: admin+ see everything; a
--     coordinator sees only companies/notes/follow-ups tied to a company
--     they're assigned to; faculty/viewer can browse the company list
--     itself but not notes/HR contacts belonging to others.
--   Company/note/follow-up EDITING: admin+ can edit anything; Faculty can
--     edit only what THEY personally created; coordinators can edit only
--     their own follow-ups for companies they're assigned to.

-- ── companies ────────────────────────────────────────────────────────────
drop policy if exists "authenticated full access" on public.companies;
drop policy if exists "everyone reads companies" on public.companies;
drop policy if exists "coordinator+ can add companies" on public.companies;
drop policy if exists "coordinator+ can update companies" on public.companies;
drop policy if exists "admin+ can delete companies" on public.companies;
drop policy if exists "companies read scoped" on public.companies;
drop policy if exists "companies insert scoped" on public.companies;
drop policy if exists "companies update scoped" on public.companies;
drop policy if exists "companies delete scoped" on public.companies;

create policy "companies read scoped" on public.companies
  for select to authenticated using (
    public.is_admin_or_above()
    or public.current_role() in ('faculty', 'viewer')
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = companies.id and ca.user_id = auth.uid()
    )
  );

create policy "companies insert scoped" on public.companies
  for insert to authenticated with check (
    public.current_role() in ('super_admin', 'admin', 'faculty')
  );

create policy "companies update scoped" on public.companies
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or (public.current_role() = 'faculty' and created_by = auth.uid())
  );

create policy "companies delete scoped" on public.companies
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin')
  );

-- ── notes ────────────────────────────────────────────────────────────────
drop policy if exists "authenticated full access" on public.notes;
drop policy if exists "everyone reads notes" on public.notes;
drop policy if exists "everyone creates notes" on public.notes;
drop policy if exists "own note or admin deletes" on public.notes;
drop policy if exists "notes read scoped" on public.notes;
drop policy if exists "notes write scoped" on public.notes;
drop policy if exists "notes insert scoped" on public.notes;
drop policy if exists "notes update scoped" on public.notes;
drop policy if exists "notes delete scoped" on public.notes;

create policy "notes read scoped" on public.notes
  for select to authenticated using (
    public.is_admin_or_above()
    or created_by = auth.uid()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = notes.company_id and ca.user_id = auth.uid()
    )
  );

create policy "notes insert scoped" on public.notes
  for insert to authenticated with check (
    public.is_admin_or_above()
    or public.current_role() = 'faculty'
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = notes.company_id and ca.user_id = auth.uid()
    )
  );

create policy "notes update scoped" on public.notes
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin') or created_by = auth.uid()
  );

create policy "notes delete scoped" on public.notes
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin') or created_by = auth.uid()
  );

-- ── followups ────────────────────────────────────────────────────────────
drop policy if exists "authenticated full access" on public.followups;
drop policy if exists "everyone reads followups" on public.followups;
drop policy if exists "everyone creates followups" on public.followups;
drop policy if exists "own followup or admin updates" on public.followups;
drop policy if exists "own followup or admin deletes" on public.followups;
drop policy if exists "followups read scoped" on public.followups;
drop policy if exists "followups insert scoped" on public.followups;
drop policy if exists "followups update scoped" on public.followups;
drop policy if exists "followups delete scoped" on public.followups;

create policy "followups read scoped" on public.followups
  for select to authenticated using (
    public.is_admin_or_above()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = followups.company_id and ca.user_id = auth.uid()
    )
  );

create policy "followups insert scoped" on public.followups
  for insert to authenticated with check (
    public.is_admin_or_above()
    or public.current_role() = 'faculty'
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = followups.company_id and ca.user_id = auth.uid()
    )
  );

create policy "followups update scoped" on public.followups
  for update to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or created_by = auth.uid()
    or assigned_to = auth.uid()
  );

create policy "followups delete scoped" on public.followups
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin')
    or created_by = auth.uid()
    or assigned_to = auth.uid()
  );

-- ── contacts (HR details) — re-affirm, explicitly clearing every old name
--    too, since this is exactly the kind of leftover-policy bug we're
--    fixing across the board here.
drop policy if exists "authenticated full access" on public.contacts;
drop policy if exists "contacts visible to assigned or managers" on public.contacts;
drop policy if exists "contacts write access" on public.contacts;

create policy "contacts visible to assigned or managers" on public.contacts
  for select to authenticated using (
    public.is_admin_or_above()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = contacts.company_id and ca.user_id = auth.uid()
    )
  );

create policy "contacts write access" on public.contacts
  for all to authenticated using (
    public.is_admin_or_above()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = contacts.company_id and ca.user_id = auth.uid()
    )
  ) with check (
    public.is_admin_or_above()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = contacts.company_id and ca.user_id = auth.uid()
    )
  );
