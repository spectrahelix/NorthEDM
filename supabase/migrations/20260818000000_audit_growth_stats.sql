-- Growth stats for the weekly site audit (.github/workflows/weekly-audit.yml).
-- SECURITY DEFINER so it can read auth.users; execute is granted ONLY to
-- service_role (the audit workflow authenticates with the service key), so it
-- exposes nothing to anon/authenticated clients.
create or replace function public.audit_growth_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_users',   (select count(*) from auth.users),
    'new_7d',        (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_30d',       (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'latest_signup', (select max(created_at) from auth.users),
    'reports_open',  (select count(*) from public.error_reports where status in ('new','triaged')),
    'reports_new',   (select count(*) from public.error_reports where status = 'new'),
    'reports_total', (select count(*) from public.error_reports)
  );
$$;

revoke all on function public.audit_growth_stats() from public;
revoke all on function public.audit_growth_stats() from anon;
revoke all on function public.audit_growth_stats() from authenticated;
grant execute on function public.audit_growth_stats() to service_role;
