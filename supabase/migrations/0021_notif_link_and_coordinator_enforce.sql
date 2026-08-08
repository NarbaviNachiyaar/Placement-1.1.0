-- Run in Supabase SQL Editor after previous migrations.

-- ── #6 fix: notifications need a real link to navigate to, separate from
--    the internal key reminders.ts uses to avoid re-notifying the same
--    thing every reload.
alter table public.notifications add column if not exists dedupe_key text;

-- ── #1: enforce at the database level that a company can only be
--    assigned to a user whose role is 'coordinator' — not just a
--    frontend filter on the picker.
create or replace function public.enforce_coordinator_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles where user_id = new.user_id and role = 'coordinator'
  ) then
    raise exception 'Companies can only be assigned to Placement Coordinators';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_coordinator_assignment on public.company_assignments;
create trigger trg_enforce_coordinator_assignment
  before insert on public.company_assignments
  for each row execute function public.enforce_coordinator_assignment();
