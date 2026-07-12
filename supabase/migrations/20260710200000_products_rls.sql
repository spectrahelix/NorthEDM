-- products RLS policies.
--
-- The table had RLS ENABLED but ZERO policies, so every anon/authenticated
-- read and write was denied — only the service role could touch it. That
-- silently broke the vendor self-upload (Vendor Dashboard) and any user-client
-- read of the menu. These policies restore intended access:
--
--   read   → anyone sees published + public products; owners/admins see all.
--   write  → the vendor a user is linked to (with marketplace access) may
--            manage that vendor's products; admins may manage any.
--
-- Mirrors the app-layer guard in utils/marketplace.ts (canManageInventory).

alter table public.products enable row level security;

-- caller's linked vendor (null if none) — used by the ownership checks.
-- Inlined as a subquery in each policy for clarity.

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (
    (is_public = true and status = 'published')
    or vendor_id = (select p.vendor_id from public.profiles p where p.id = auth.uid())
    or (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('archon', 'warden')
    )
  );

drop policy if exists "products owner insert" on public.products;
create policy "products owner insert" on public.products
  for insert with check (
    (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('archon', 'warden')
    )
    or (
      vendor_id = (select p.vendor_id from public.profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.is_marketplace = true
      )
    )
  );

drop policy if exists "products owner update" on public.products;
create policy "products owner update" on public.products
  for update
  using (
    (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('archon', 'warden')
    )
    or (
      vendor_id = (select p.vendor_id from public.profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.is_marketplace = true
      )
    )
  )
  with check (
    (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('archon', 'warden')
    )
    or (
      vendor_id = (select p.vendor_id from public.profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.is_marketplace = true
      )
    )
  );

drop policy if exists "products owner delete" on public.products;
create policy "products owner delete" on public.products
  for delete using (
    (auth.jwt() ->> 'email') = 'cjblue27@gmail.com'
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('archon', 'warden')
    )
    or (
      vendor_id = (select p.vendor_id from public.profiles p where p.id = auth.uid())
      and exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.is_marketplace = true
      )
    )
  );
