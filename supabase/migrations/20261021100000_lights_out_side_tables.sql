-- Lights out has to reach the side tables too.
--
-- Found 2026-10-21 by reading the database directly with the publishable key,
-- the way any script on the internet can: festdash_vendors, store_vendors and
-- vendor_shows were readable in full for a suspended vendor — ids, join dates,
-- the operator's user id and festdash_vendors.stripe_account_id — while every
-- page correctly 404'd. Pages are not the security boundary; RLS is.
--
-- Fix: each side table now follows the vendors table's own RLS. Whoever can see
-- the vendor (the public for a listed, unsuspended one; the vendor's own
-- account; site admins) can see its rows; nobody else can. Done with ALTER so
-- the policy names stay what the rest of the migrations expect.
alter policy "Public read FestDash vendors" on public.festdash_vendors
  using (is_active = true
         and exists (select 1 from public.vendors v where v.id = festdash_vendors.vendor_id));

alter policy "public read store vendors" on public.store_vendors
  using (exists (select 1 from public.vendors v where v.id = store_vendors.vendor_id));

alter policy "vendor_shows public read" on public.vendor_shows
  using (auth.uid() = vendor_shows.user_id
         or public.is_site_admin()
         or exists (select 1 from public.vendors v where v.user_id = vendor_shows.user_id));

-- A vendor's Stripe account id is read only by our own server (service role).
-- A column-level REVOKE alone does nothing while the role still holds the
-- table-wide SELECT grant (verified: still readable), so drop that grant and
-- re-grant just the columns the public API reads.
revoke select on table public.festdash_vendors from anon, authenticated;
grant select (id, vendor_id, is_active, joined_at) on public.festdash_vendors to anon, authenticated;

notify pgrst, 'reload schema';
