-- ============================================================
-- Placement Pro — FULL combined migration, correct run order
-- ============================================================

-- ---------- 0001_auth_tables.sql ----------
-- Run this once in Supabase Dashboard → SQL Editor (or via `supabase db push`).
-- Creates the tables the app's real auth flow depends on: approved_users,
-- profiles, user_roles — plus a trigger that auto-creates a profile + default
-- role the moment someone signs up through Supabase Auth.

create extension if not exists pgcrypto;

-- ── approved_users ─────────────────────────────────────────────────────────
-- Invite-only allow-list. Checked BEFORE sign-in, so anon must be able to
-- read it (only email/role/is_active — no secrets live here).
create table if not exists public.approved_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'viewer'
    check (role in ('super_admin','admin','coordinator','faculty','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.approved_users enable row level security;

drop policy if exists "anon can check approval" on public.approved_users;
create policy "anon can check approval" on public.approved_users
  for select to anon, authenticated using (true);

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  department text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  last_login timestamptz
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- ── user_roles ──────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null
    check (role in ('super_admin','admin','coordinator','faculty','viewer')),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- Now that user_roles exists, it's safe to create the policy that
-- references it (this was previously created too early, before the table
-- it depends on existed — fixed here).
drop policy if exists "admins manage approved_users" on public.approved_users;
create policy "admins manage approved_users" on public.approved_users
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role in ('super_admin','admin')
    )
  );

-- ── auto-provision on signup ─────────────────────────────────────────────────
-- Mirrors what the old mock startSession() did: create a profile + assign the
-- approved_users role (default 'viewer') the moment a user first signs in.
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
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 0002_crm_tables.sql ----------
-- Run this in Supabase Dashboard → SQL Editor, AFTER 0001_auth_tables.sql.
-- Creates every table the CRM needs so ALL data (companies, contacts, tasks,
-- followups, notes, activity logs, notifications) is stored in Supabase
-- instead of the browser's localStorage.
--
-- RLS policy used here: any authenticated (signed-in + approved) user can
-- read/write these tables. Sign-in is already gated by approved_users, so
-- this matches how the app currently behaves. Tighten per-role later if you
-- want, e.g. restrict deletes to admins only.

create extension if not exists pgcrypto;

-- ── companies ────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  location text,
  website text,
  linkedin text,
  status text not null default 'new',
  company_type text,
  company_size text,
  description text,
  campus_drive_date date,
  deleted_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;
drop policy if exists "authenticated full access" on public.companies;
create policy "authenticated full access" on public.companies
  for all to authenticated using (true) with check (true);

-- ── company_assignments ─────────────────────────────────────────────────────
create table if not exists public.company_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

alter table public.company_assignments enable row level security;
drop policy if exists "authenticated full access" on public.company_assignments;
create policy "authenticated full access" on public.company_assignments
  for all to authenticated using (true) with check (true);

-- ── contacts ─────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  designation text,
  email text,
  phone text,
  linkedin text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;
drop policy if exists "authenticated full access" on public.contacts;
create policy "authenticated full access" on public.contacts
  for all to authenticated using (true) with check (true);

-- ── followups ────────────────────────────────────────────────────────────────
create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  followup_date date not null,
  followup_time time,
  mode text not null default 'call',
  priority text not null default 'medium',
  status text not null default 'pending',
  message text,
  voice_transcript text,
  assigned_to uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  next_followup_date date,
  next_followup_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.followups enable row level security;
drop policy if exists "authenticated full access" on public.followups;
create policy "authenticated full access" on public.followups
  for all to authenticated using (true) with check (true);

-- ── notes (company notes) ─────────────────────────────────────────────────────
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  content text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;
drop policy if exists "authenticated full access" on public.notes;
create policy "authenticated full access" on public.notes
  for all to authenticated using (true) with check (true);

-- ── tasks ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_by uuid references public.profiles (id),
  assigned_to uuid references public.profiles (id),
  department text,
  priority text not null default 'medium',
  status text not null default 'pending',
  progress int not null default 0,
  deadline date,
  completed_at timestamptz,
  company_id uuid references public.companies (id) on delete set null,
  review_status text not null default 'none',
  extension_requested boolean not null default false,
  extension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
drop policy if exists "authenticated full access" on public.tasks;
create policy "authenticated full access" on public.tasks
  for all to authenticated using (true) with check (true);

-- ── task_notes ───────────────────────────────────────────────────────────────
create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  content text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.task_notes enable row level security;
drop policy if exists "authenticated full access" on public.task_notes;
create policy "authenticated full access" on public.task_notes
  for all to authenticated using (true) with check (true);

-- ── task_attachments ─────────────────────────────────────────────────────────
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  name text not null,
  size bigint,
  type text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.task_attachments enable row level security;
drop policy if exists "authenticated full access" on public.task_attachments;
create policy "authenticated full access" on public.task_attachments
  for all to authenticated using (true) with check (true);

-- ── activity_logs ────────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  user_email text,
  action text not null,
  entity_type text,
  entity_id uuid,
  company_id uuid references public.companies (id) on delete set null,
  details text,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;
drop policy if exists "authenticated full access" on public.activity_logs;
create policy "authenticated full access" on public.activity_logs
  for all to authenticated using (true) with check (true);

-- ── notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  type text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists "authenticated full access" on public.notifications;
create policy "authenticated full access" on public.notifications
  for all to authenticated using (true) with check (true);

-- ── helpful indexes ──────────────────────────────────────────────────────────
create index if not exists idx_contacts_company on public.contacts (company_id);
create index if not exists idx_followups_company on public.followups (company_id);
create index if not exists idx_notes_company on public.notes (company_id);
create index if not exists idx_tasks_company on public.tasks (company_id);
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);
create index if not exists idx_task_notes_task on public.task_notes (task_id);
create index if not exists idx_task_attachments_task on public.task_attachments (task_id);
create index if not exists idx_notifications_user on public.notifications (user_id);
create index if not exists idx_activity_logs_company on public.activity_logs (company_id);

-- ---------- 0003_grants.sql ----------
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

-- ---------- 0004_rbac_lockdown.sql ----------
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

-- ---------- 0005_extended_profiles.sql ----------
-- Run in Supabase SQL Editor after previous migrations.
-- Phase 3 — extended user profile fields (staff fields common to everyone,
-- plus Placement Coordinator / student-specific fields).

alter table public.profiles
  add column if not exists alternate_phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists emergency_contact text,
  add column if not exists blood_group text,
  add column if not exists joining_date date,
  add column if not exists designation text,
  -- Placement Coordinator / student fields
  add column if not exists student_id text,
  add column if not exists roll_number text,
  add column if not exists course text,
  add column if not exists academic_year text,
  add column if not exists semester text,
  add column if not exists section text,
  add column if not exists batch text,
  add column if not exists parent_name text,
  add column if not exists parent_phone text,
  add column if not exists parent_email text,
  add column if not exists hostel_or_day_scholar text,
  add column if not exists faculty_mentor text;

-- ---------- 0006_roles_departments_lockdown.sql ----------
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

-- ---------- 0007_messaging.sql ----------
-- Run in Supabase SQL Editor after previous migrations.
-- Phase 7 — internal team communication (1:1, groups, department chats,
-- company discussion threads, file/image sharing, read receipts).
--
-- Typing indicators use Supabase Realtime Broadcast (ephemeral, no table
-- needed) — wired client-side only. Task comments already exist via the
-- `task_notes` table from Phase 0, so this migration doesn't duplicate that.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group', 'department', 'company')),
  title text,
  department text,
  company_id uuid references public.companies (id) on delete cascade,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  content text,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- A user can see a conversation only if they're a participant in it.
drop policy if exists "participants read their conversations" on public.conversations;
create policy "participants read their conversations" on public.conversations
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated can create conversations" on public.conversations;
create policy "authenticated can create conversations" on public.conversations
  for insert to authenticated with check (true);

-- Participants: you can see the participant list of conversations you're
-- in, and you can add yourself/others when creating a conversation.
drop policy if exists "see participants of own conversations" on public.conversation_participants;
create policy "see participants of own conversations" on public.conversation_participants
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants me
      where me.conversation_id = conversation_participants.conversation_id
        and me.user_id = auth.uid()
    )
  );

drop policy if exists "authenticated can add participants" on public.conversation_participants;
create policy "authenticated can add participants" on public.conversation_participants
  for insert to authenticated with check (true);

drop policy if exists "users update their own participant row" on public.conversation_participants;
create policy "users update their own participant row" on public.conversation_participants
  for update to authenticated using (user_id = auth.uid());

-- Messages: only participants can read or send.
drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;

create index if not exists idx_conv_participants_user on public.conversation_participants (user_id);
create index if not exists idx_conv_participants_conv on public.conversation_participants (conversation_id);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);

-- Stream new messages live to everyone subscribed.
alter publication supabase_realtime add table public.messages;

-- ── Storage bucket for shared files/images/documents in chat ───────────────
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

drop policy if exists "authenticated upload chat files" on storage.objects;
create policy "authenticated upload chat files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-attachments');

drop policy if exists "anyone can view chat files" on storage.objects;
create policy "anyone can view chat files" on storage.objects
  for select using (bucket_id = 'message-attachments');

-- ---------- 0008_multi_institution.sql ----------
-- Run in Supabase SQL Editor after previous migrations.
-- Phase 6 — multi-institution support.
--
-- Recruiters can be more than corporate companies (hospitals, healthcare
-- orgs, research institutes, pharma companies), and each recruiter can be
-- mapped to one or more of the university's schools/departments.

alter table public.companies
  add column if not exists recruiter_type text not null default 'company'
    check (recruiter_type in ('company', 'hospital', 'healthcare_organization', 'research_institute', 'pharmaceutical_company'));

create table if not exists public.company_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  department text not null,
  created_at timestamptz not null default now(),
  unique (company_id, department)
);

alter table public.company_departments enable row level security;

drop policy if exists "authenticated full access" on public.company_departments;
create policy "authenticated full access" on public.company_departments
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.company_departments to authenticated;
grant select on public.company_departments to anon;

create index if not exists idx_company_departments_company on public.company_departments (company_id);
create index if not exists idx_companies_recruiter_type on public.companies (recruiter_type);

-- ---------- 0009_fix_company_delete_policy.sql ----------
-- Run in Supabase SQL Editor AFTER 0006_roles_departments_lockdown.sql
-- (your existing file) and after 0008_multi_institution.sql.
--
-- Corrects one policy from 0006_roles_departments_lockdown.sql: that file's
-- "admin+ can delete companies" policy uses is_admin_or_above(), which
-- includes Faculty. Per the original spec, only Super Admin + Admin should
-- delete companies — Faculty should not. This tightens that one policy.

drop policy if exists "admin+ can delete companies" on public.companies;
create policy "admin+ can delete companies" on public.companies
  for delete to authenticated using (
    public.current_role() in ('super_admin', 'admin')
  );

-- ---------- 0010_self_heal_profile.sql ----------
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

