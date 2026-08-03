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
