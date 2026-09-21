-- Fold public.profiles into public.user_profiles, then retire it.
--
-- THE PROBLEM. Two identity tables lived side by side. Only user_profiles was
-- trigger-populated (handle_new_user), so profiles held 3 rows against 14
-- users: 11 of 14 people had no row at all. About twenty code paths and
-- thirteen RLS policies resolved identity through it, and every one failed
-- CLOSED for those users — vendor product management, all four Square routes,
-- the FestDash vendor dashboard, promo codes, referral generation, and a
-- FestDash vendor's view of their own orders. The two role vocabularies did not
-- overlap at all (admin/vendor/user vs archon/drifter/merchant), so a check
-- against the wrong table could never accidentally pass.
--
-- profiles held exactly two things user_profiles lacked: username, vendor_id.

alter table public.user_profiles
  add column if not exists username  text,
  add column if not exists vendor_id bigint;

comment on column public.user_profiles.username is
  'Forum handle. Moved from the retired public.profiles table.';
comment on column public.user_profiles.vendor_id is
  'The vendor this account operates, if any. Moved from the retired public.profiles table.';

update public.user_profiles up
   set username  = coalesce(up.username, p.username),
       vendor_id = coalesce(up.vendor_id, p.vendor_id)
  from public.profiles p
 where p.id = up.id;

-- Case-insensitive: app code compares with eq(), and "CJBlue" must not be
-- claimable alongside "cjblue".
create unique index if not exists user_profiles_username_uidx
  on public.user_profiles (lower(username)) where username is not null;

-- Reconcile the OTHER half of the split. Vendor ownership was recorded twice —
-- vendors.user_id (what RLS uses) and profiles.vendor_id (what the API routes
-- used) — and they disagreed: vendor 5 had a profiles link but a NULL user_id,
-- which is why editing that listing silently did nothing.
update public.vendors v
   set user_id = up.id
  from public.user_profiles up
 where up.vendor_id = v.id and v.user_id is null;

-- ── Repoint every dependent policy ────────────────────────────────────────
-- Thirteen in total. Five resolved identity only through profiles; eight
-- referenced both tables, which is how a first scan missed them — the drop
-- below is RESTRICT precisely so that mistake surfaced instead of cascading.

drop policy if exists "admin read all vendors" on public.vendors;
create policy "admin read all vendors" on public.vendors
  for select to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden')));

drop policy if exists "admin update vendors" on public.vendors;
create policy "admin update vendors" on public.vendors
  for update to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden')));

drop policy if exists "admin delete threads" on public.threads;
create policy "admin delete threads" on public.threads
  for delete to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden')));

drop policy if exists "admin delete replies" on public.replies;
create policy "admin delete replies" on public.replies
  for delete to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden')));

drop policy if exists "Vendors see their orders" on public.festdash_orders;
create policy "Vendors see their orders" on public.festdash_orders
  for select to authenticated
  using (vendor_id in (select up.vendor_id from public.user_profiles up
                       where up.id = auth.uid() and up.vendor_id is not null));

drop policy if exists "Vendors update their order status" on public.festdash_orders;
create policy "Vendors update their order status" on public.festdash_orders
  for update to authenticated
  using (vendor_id in (select up.vendor_id from public.user_profiles up
                       where up.id = auth.uid() and up.vendor_id is not null));

drop policy if exists "Owners see own promo codes" on public.festdash_promo_codes;
create policy "Owners see own promo codes" on public.festdash_promo_codes
  for select to authenticated
  using (owner_id = auth.uid()
         or vendor_id in (select up.vendor_id from public.user_profiles up
                          where up.id = auth.uid() and up.vendor_id is not null));

-- The owner-email break-glass in the policies below is pre-existing and kept.

drop policy if exists "admin read bookings" on public.bookings;
create policy "admin read bookings" on public.bookings
  for select to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden'))
         or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com');

drop policy if exists "admin manage bookings" on public.bookings;
create policy "admin manage bookings" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden'))
         or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com');

drop policy if exists "admin read requests" on public.requests;
create policy "admin read requests" on public.requests
  for select to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden'))
         or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com');

drop policy if exists "admin manage requests" on public.requests;
create policy "admin manage requests" on public.requests
  for update to authenticated
  using (exists (select 1 from public.user_profiles up
                 where up.id = auth.uid() and up.role in ('archon','warden'))
         or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com');

-- products: ownership resolved ONLY through profiles.vendor_id, so a
-- marketplace vendor without a profiles row could not read, insert, update or
-- delete their own products.
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select
  using ((is_public = true and status = 'published')
         or vendor_id = (select up.vendor_id from public.user_profiles up where up.id = auth.uid())
         or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
         or exists (select 1 from public.user_profiles up
                    where up.id = auth.uid() and up.role in ('archon','warden')));

drop policy if exists "products owner insert" on public.products;
create policy "products owner insert" on public.products
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
              or exists (select 1 from public.user_profiles up
                         where up.id = auth.uid() and up.role in ('archon','warden'))
              or (vendor_id = (select up.vendor_id from public.user_profiles up where up.id = auth.uid())
                  and exists (select 1 from public.user_profiles up
                              where up.id = auth.uid() and up.is_marketplace = true)));

drop policy if exists "products owner update" on public.products;
create policy "products owner update" on public.products
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
         or exists (select 1 from public.user_profiles up
                    where up.id = auth.uid() and up.role in ('archon','warden'))
         or (vendor_id = (select up.vendor_id from public.user_profiles up where up.id = auth.uid())
             and exists (select 1 from public.user_profiles up
                         where up.id = auth.uid() and up.is_marketplace = true)))
  with check ((auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
              or exists (select 1 from public.user_profiles up
                         where up.id = auth.uid() and up.role in ('archon','warden'))
              or (vendor_id = (select up.vendor_id from public.user_profiles up where up.id = auth.uid())
                  and exists (select 1 from public.user_profiles up
                              where up.id = auth.uid() and up.is_marketplace = true)));

drop policy if exists "products owner delete" on public.products;
create policy "products owner delete" on public.products
  for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
         or exists (select 1 from public.user_profiles up
                    where up.id = auth.uid() and up.role in ('archon','warden'))
         or (vendor_id = (select up.vendor_id from public.user_profiles up where up.id = auth.uid())
             and exists (select 1 from public.user_profiles up
                         where up.id = auth.uid() and up.is_marketplace = true)));

drop table if exists public.profiles restrict;
