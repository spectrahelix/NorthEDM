-- Applications now carry two addresses. vendors.email is the PERSONAL one —
-- the address of the account that will run this vendor, used to link it on
-- approval. business_email is optional and only a public-facing contact.
--
-- On 2026-10-10 a real vendor applied with a business address that matched no
-- account, while his own login used a different address, so approval had
-- nothing to connect to.
alter table public.vendors
  add column if not exists business_email text;

comment on column public.vendors.email is
  'Personal email of the person who will manage this vendor. Must match their account login so approval can grant them the dashboard.';
comment on column public.vendors.business_email is
  'Optional public-facing business contact. Never used for account linking.';

-- Applications submitted while signed in now record the applicant's account
-- directly. The insert policy did not constrain user_id at all, so a direct
-- API call could have filed an application owned by SOMEONE ELSE's account,
-- and approving it would have handed them a vendor dashboard they never asked
-- for. Only your own account, or none.
--
-- Verified in a rolled-back transaction:
--   visitor, no account              -> accepted
--   visitor, claims another account  -> refused
--   signed in, own account           -> accepted
--   signed in, claims another acct   -> refused
alter policy "public apply as vendor" on public.vendors
  with check (
    coalesce(status, 'pending') = 'pending'
    and coalesce(is_public, false) = false
    and coalesce(is_founder, false) = false
    and (user_id is null or user_id = auth.uid())
  );
