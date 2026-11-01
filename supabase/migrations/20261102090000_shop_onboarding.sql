-- Shop self-onboarding for coordinator regions (2026-11-02).
-- A shop owner creates their own account and applies at /festdash/shop-setup;
-- the application carries their payout wallets, the coordinator code that
-- links them to their purse keeper, and their acceptance of the fee and split.
-- payout_wallets, coordinator_code and terms_accepted_at stay private (vendors
-- is column-granted; these are not granted). area is public.
alter table public.vendors
  add column if not exists payout_wallets jsonb,
  add column if not exists coordinator_code text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists area text;
grant select (area) on table public.vendors to anon, authenticated;

-- The owner-and-admin RPC now returns the private onboarding fields too.
create or replace function public.vendor_private_contact(p_vendor_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'email', v.email, 'first_name', v.first_name, 'last_name', v.last_name,
      'payout_wallets', v.payout_wallets, 'coordinator_code', v.coordinator_code,
      'terms_accepted_at', v.terms_accepted_at)
    from public.vendors v
    where v.id = p_vendor_id
      and (v.user_id = auth.uid() or public.is_site_admin())
  ), '{}'::jsonb)
$$;

notify pgrst, 'reload schema';
