-- 1. Suspension, kept separate from the listing preference.
--
-- Suspending a vendor for non-payment is a DIFFERENT thing from their listing
-- preference, and must not overwrite it. Reusing is_public would lose whether
-- they ever wanted to be public, so reinstating them after they pay becomes a
-- guess.
--
--   is_public     what they are listed as when in good standing (admin sets it)
--   suspended_at  billing state; hides them regardless, and reverses cleanly
alter table public.vendors
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

comment on column public.vendors.suspended_at is
  'Set to hide a vendor from public view without touching is_public — e.g. an unpaid invoice. Clearing it restores exactly the visibility they had before.';

-- The gate that actually matters. Without this, a suspension would show in the
-- admin UI and change nothing a visitor sees — worse than having no suspension
-- at all, because it would look like it worked.
alter policy public_read_vendors on public.vendors
  using (status = 'approved' and is_public = true and suspended_at is null);

-- 2. Finding the account behind a vendor application.
--
-- Granting access means connecting the application (which carries only an
-- email, because the form is open to people who aren't signed in) to their
-- account. auth.users is not reachable over PostgREST, and
-- auth.admin.listUsers() is paginated and would quietly miss people once the
-- site grows past a page.
create or replace function public.user_id_for_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  order by u.created_at asc
  limit 1
$$;

-- service_role only. Exposed any wider this is an oracle for "does an account
-- exist at this address", which is exactly what the signup and reset flows go
-- out of their way not to reveal.
revoke all on function public.user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.user_id_for_email(text) to service_role;

comment on function public.user_id_for_email(text) is
  'Service-role only. Finds the account behind a vendor application email so an admin can grant dashboard access on approval.';
