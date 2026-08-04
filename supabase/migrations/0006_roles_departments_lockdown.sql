-- Run in Supabase SQL Editor, AFTER 0001–0005 (before 0007_messaging.sql).
-- Phase 2 — fills the gap left by 0004: row-level enforcement for
-- companies/hospitals/tasks/followups per role, plus departments &
-- hospital-vs-company recruiter support, plus profile picture storage.
--
-- Role recap (must match public.approved_users / public.user_roles check):
--   super_admin  — full access to everything, incl. Supabase data, can
--                   remove/invite team members, only one who can revoke
--                   another admin's permissions, only one who sees
--                   activity_logs (already enforced in 0004).
--   admin        — views all logs (read-only), can't edit others' logs,
--                   can invite people, assigns work to coordinators.
--   faculty      — same as admin except CANNOT invite people.
--   coordinator  — sees only tasks assigned to them; can view (read-only)
--                   everyone else's records but can only edit/delete their
--                   OWN records.
--   viewer       — read-only on companies/hospitals + progress, nothing else.

-- ── helper: current user's role (single source of truth for policies) ──────
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;

grant execute on function public.current_role() to authenticated, anon;

create or replace function public.is_admin_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('super_admin', 'admin', 'faculty');
$$;

grant execute on function public.is_admin_or_above() to authenticated, anon;

-- ── departments / schools reference table ───────────────────────────────────
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

insert into public.departments (name) values
  ('School of Health Sciences'),
  ('School of Technology'),
  ('School of Management'),
  ('Apollo Institute of Pharmaceutical Sciences')
on conflict (name) do nothing;

alter table public.departments enable row level security;
drop policy if exists "authenticated read departments" on public.departments;
create policy "authenticated read departments" on public.departments
  for select to authenticated using (true);
drop policy if exists "admin manage departments" on public.departments;
create policy "admin manage departments" on public.departments
  for all to authenticated using (public.is_admin_or_above()) with check (public.is_admin_or_above());

grant select on public.departments to authenticated, anon;
grant insert, update, delete on public.departments to authenticated;

-- ── companies: distinguish recruiter companies vs hospitals, tag department ─
alter table public.companies
  add column if not exists org_kind text not null default 'company'
    check (org_kind in ('company', 'hospital')),
  add column if not exists department text references public.departments (name);

-- Viewer must be read-only everywhere. Replace the old blanket "authenticated
-- full access" with role-aware policies.
drop policy if exists "authenticated full access" on public.companies;

drop policy if exists "everyone reads companies" on public.companies;
create policy "everyone reads companies" on public.companies
  for select to authenticated using (true);

drop policy if exists "coordinator+ can add companies" on public.companies;
create policy "coordinator+ can add companies" on public.companies
  for insert to authenticated with check (public.current_role() <> 'viewer');

drop policy if exists "coordinator+ can update companies" on public.companies;
create policy "coordinator+ can update companies" on public.companies
  for update to authenticated using (public.current_role() <> 'viewer');

drop policy if exists "admin+ can delete companies" on public.companies;
create policy "admin+ can delete companies" on public.companies
  for delete to authenticated using (public.is_admin_or_above());

-- ── tasks: coordinators see only their own; can edit/delete only their own ─
drop policy if exists "authenticated full access" on public.tasks;

drop policy if exists "read tasks by role" on public.tasks;
create policy "read tasks by role" on public.tasks
  for select to authenticated using (
    public.is_admin_or_above()
    or assigned_to = auth.uid()
    or assigned_by = auth.uid()
  );

drop policy if exists "admin+ assigns tasks" on public.tasks;
create policy "admin+ assigns tasks" on public.tasks
  for insert to authenticated with check (
    public.is_admin_or_above() or assigned_to = auth.uid()
  );

drop policy if exists "own task or admin updates" on public.tasks;
create policy "own task or admin updates" on public.tasks
  for update to authenticated using (
    public.is_admin_or_above() or assigned_to = auth.uid()
  );

drop policy if exists "own task or admin deletes" on public.tasks;
create policy "own task or admin deletes" on public.tasks
  for delete to authenticated using (
    public.is_admin_or_above() or assigned_to = auth.uid()
  );

-- ── followups: same "view all, edit/delete only your own" rule ─────────────
drop policy if exists "authenticated full access" on public.followups;

drop policy if exists "everyone reads followups" on public.followups;
create policy "everyone reads followups" on public.followups
  for select to authenticated using (true);

drop policy if exists "everyone creates followups" on public.followups;
create policy "everyone creates followups" on public.followups
  for insert to authenticated with check (true);

drop policy if exists "own followup or admin updates" on public.followups;
create policy "own followup or admin updates" on public.followups
  for update to authenticated using (
    public.is_admin_or_above() or created_by = auth.uid() or assigned_to = auth.uid()
  );

drop policy if exists "own followup or admin deletes" on public.followups;
create policy "own followup or admin deletes" on public.followups
  for delete to authenticated using (
    public.is_admin_or_above() or created_by = auth.uid() or assigned_to = auth.uid()
  );

-- ── notes: read all, edit/delete only your own (or admin+) ─────────────────
drop policy if exists "authenticated full access" on public.notes;

drop policy if exists "everyone reads notes" on public.notes;
create policy "everyone reads notes" on public.notes
  for select to authenticated using (true);

drop policy if exists "everyone creates notes" on public.notes;
create policy "everyone creates notes" on public.notes
  for insert to authenticated with check (true);

drop policy if exists "own note or admin deletes" on public.notes;
create policy "own note or admin deletes" on public.notes
  for delete to authenticated using (
    public.is_admin_or_above() or created_by = auth.uid()
  );

-- ── approved_users: only super_admin can deactivate (revoke) someone;
--    admin/faculty(non-invite excluded below) can invite but not revoke.
--    Faculty must NOT be able to invite — only admin/super_admin can insert.
drop policy if exists "managers invite approved users" on public.approved_users;
create policy "managers invite approved users" on public.approved_users
  for insert to authenticated with check (
    public.current_role() in ('super_admin', 'admin')
  );

-- ── profile pictures: everyone can upload their own avatar ─────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "anyone can view avatars" on storage.objects;
create policy "anyone can view avatars" on storage.objects
  for select using (bucket_id = 'avatars');

create index if not exists idx_companies_org_kind on public.companies (org_kind);
create index if not exists idx_companies_department on public.companies (department);
