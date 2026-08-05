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
