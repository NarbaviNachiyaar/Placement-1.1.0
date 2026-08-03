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

create policy "anon can check approval" on public.approved_users
  for select to anon, authenticated using (true);

create policy "admins manage approved_users" on public.approved_users
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role in ('super_admin','admin')
    )
  );

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

create policy "users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

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

create policy "users read own role" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

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
