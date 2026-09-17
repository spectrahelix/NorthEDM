-- Submissions require a CONFIRMED account, enforced in the database.
--
-- The API routes check this too, but RLS is what actually closes the door: the
-- "public submit request" policy below had with_check TRUE, so anon could POST
-- straight to PostgREST and insert rows without touching the app at all.
--
-- Merely being signed in is not the bar. An unconfirmed account costs a bot
-- nothing to create; clearing an email round-trip is the signal worth having.

create or replace function public.is_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and email_confirmed_at is not null
  );
$$;

comment on function public.is_verified() is
  'True when the caller is signed in AND has confirmed their email. SECURITY DEFINER because auth.users is not readable by application roles. Used by submission RLS policies.';

-- Lock execution down to signed-in callers. BOTH revokes are required and each
-- catches a different grant:
--   * PUBLIC — Postgres grants EXECUTE on every new function to PUBLIC.
--   * anon   — Supabase's ALTER DEFAULT PRIVILEGES additionally grants EXECUTE
--              on new public-schema functions straight to anon, so it survives
--              the PUBLIC revoke. Verified by probing the live REST endpoint:
--              anon could still call it after the PUBLIC revoke alone.
revoke execute on function public.is_verified() from public;
revoke execute on function public.is_verified() from anon;
grant execute on function public.is_verified() to authenticated;

-- requests: was wide open to anonymous inserts.
drop policy if exists "public submit request" on public.requests;
drop policy if exists "verified submit request" on public.requests;
create policy "verified submit request" on public.requests
  for insert to authenticated
  with check (public.is_verified());

-- vendor_shows: was owner-only, which still allowed an unconfirmed account.
drop policy if exists "vendor_shows owner insert" on public.vendor_shows;
drop policy if exists "vendor_shows verified owner insert" on public.vendor_shows;
create policy "vendor_shows verified owner insert" on public.vendor_shows
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_verified());
