-- Run in Supabase SQL Editor after previous migrations.

-- ── #12 fix: company_assignments.assigned_by was referenced by the app
--    code but never existed as a column ──────────────────────────────────
alter table public.company_assignments
  add column if not exists assigned_by uuid references public.profiles (id);

-- ── #2 fix: HR contact details should only be visible to managers/faculty
--    and to coordinators who are actually assigned to that company — not
--    to every coordinator. Companies themselves stay read-all (coordinators
--    can still browse the company list), just not the HR contact info.
drop policy if exists "authenticated full access" on public.contacts;
drop policy if exists "contacts visible to assigned or managers" on public.contacts;
create policy "contacts visible to assigned or managers" on public.contacts
  for select to authenticated using (
    public.is_admin_or_above()
    or exists (
      select 1 from public.company_assignments ca
      where ca.company_id = contacts.company_id and ca.user_id = auth.uid()
    )
  );

drop policy if exists "contacts write access" on public.contacts;
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

-- ── #3: message edit / unsend (soft delete) ─────────────────────────────
alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

drop policy if exists "senders edit own messages" on public.messages;
create policy "senders edit own messages" on public.messages
  for update to authenticated using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

grant update on public.messages to authenticated;

-- ── #7 / #11: Announcements — visible to everyone, postable by everyone,
--    deletable by the author or a Super Admin ──────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "everyone reads announcements" on public.announcements;
create policy "everyone reads announcements" on public.announcements
  for select to authenticated using (true);

drop policy if exists "everyone can post announcements" on public.announcements;
create policy "everyone can post announcements" on public.announcements
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "author or super admin deletes announcement" on public.announcements;
create policy "author or super admin deletes announcement" on public.announcements
  for delete to authenticated using (
    author_id = auth.uid() or public.is_super_admin()
  );

grant select, insert, delete on public.announcements to authenticated;

-- ── #1: the FULL profiles table (address, DOB, parent info, phone, etc.)
--    should only be browsable by Super Admin + Admin, or your own row.
--    Messaging and search still need to look SOMEONE up by name to
--    contact them, so we expose a narrow, safe "directory" via a function
--    instead of opening the whole table back up.
drop policy if exists "authenticated read all profiles" on public.profiles;
create policy "authenticated read all profiles" on public.profiles
  for select to authenticated using (
    id = auth.uid() or public.is_admin_or_above()
  );

create or replace function public.list_member_directory(search text default null)
returns table (id uuid, full_name text, email text, department text, is_active boolean, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.department, p.is_active, ur.role
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  where p.is_active = true
    and (
      search is null or search = ''
      or p.full_name ilike '%' || search || '%'
      or p.email ilike '%' || search || '%'
    )
  order by p.full_name;
$$;

grant execute on function public.list_member_directory(text) to authenticated;
