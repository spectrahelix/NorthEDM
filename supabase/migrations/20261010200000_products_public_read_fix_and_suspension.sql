-- Two problems in "products public read", found while making vendor suspension
-- hide products as well as the listing.
--
-- 1. LOGGED-OUT VISITORS COULD NOT READ PRODUCTS AT ALL.
--    The policy asked "is this caller the owner / an admin?" by reading
--    user_profiles directly. Anonymous visitors may not read user_profiles,
--    and Postgres checks that permission for every branch of an OR, so a
--    logged-out read of products failed with
--      permission denied for table user_profiles
--    Confirmed live against the REST API on 2026-10-10. Every public product
--    listing came back empty for anyone not signed in.
--
-- 2. A SUSPENDED VENDOR'S PRODUCTS STAYED PUBLIC.
--    A plain subquery on vendors runs as the visitor, and RLS hides suspended
--    vendors from visitors — so the check never found the suspended vendor and
--    let the products through. Confirmed: still visible to anon while suspended.
--
-- All three helpers run with definer rights and answer only a yes/no or an id
-- about the CALLER or one vendor id, so they expose nothing about anyone else.

create or replace function public.my_vendor_id()
returns bigint
language sql security definer set search_path = '' stable
as $$
  select up.vendor_id from public.user_profiles up where up.id = auth.uid()
$$;

create or replace function public.is_site_admin()
returns boolean
language sql security definer set search_path = '' stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = any (array['archon','warden'])
    ),
    false)
$$;

create or replace function public.vendor_is_suspended(p_vendor_id bigint)
returns boolean
language sql security definer set search_path = '' stable
as $$
  select exists (
    select 1 from public.vendors v
    where v.id = p_vendor_id and v.suspended_at is not null
  )
$$;

revoke all on function public.my_vendor_id()               from public;
revoke all on function public.is_site_admin()              from public;
revoke all on function public.vendor_is_suspended(bigint)  from public;
grant execute on function public.my_vendor_id()              to anon, authenticated, service_role;
grant execute on function public.is_site_admin()             to anon, authenticated, service_role;
grant execute on function public.vendor_is_suspended(bigint) to anon, authenticated, service_role;

-- Owner and admin branches are unchanged in meaning: a suspended vendor keeps
-- full access to their own inventory, so restoring brings everything back.
alter policy "products public read" on public.products
  using (
    (
      is_public = true
      and status = 'published'
      and not public.vendor_is_suspended(vendor_id)
    )
    or vendor_id = public.my_vendor_id()
    or public.is_site_admin()
  );

-- Verified as anon, in a rolled-back transaction:
--                         vendor  product
--   before suspend          1       1
--   while suspended         0       0
--   after restore           1       1
--   product kept while suspended: 1
--   other vendors' products still public: 6
