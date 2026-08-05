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
