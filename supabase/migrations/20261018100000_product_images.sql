-- Per-item photo galleries.
--
-- products.image_url stays as the item's MAIN photo (the thumbnail every list
-- shows) and is kept equal to the gallery's first image by the API, so nothing
-- that reads image_url today changes. The gallery is the ordered list behind it.

create table if not exists public.product_images (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products(id) on delete cascade,
  url         text   not null check (url ~ '^https://'),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists product_images_product_pos on public.product_images (product_id, position);

-- Same rule as editing the product itself (products owner insert/update/delete):
-- a site admin, or the product's own vendor holding marketplace access.
-- SECURITY DEFINER so the check reads products/user_profiles directly rather
-- than through the caller's RLS, which can hide rows (see products_public_read_fix).
create or replace function public.can_manage_product(pid bigint)
returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_site_admin() or exists (
    select 1 from public.products p
    join public.user_profiles up on up.id = auth.uid()
    where p.id = pid and p.vendor_id = up.vendor_id and up.is_marketplace = true
  )
$$;
revoke all on function public.can_manage_product(bigint) from public;
grant execute on function public.can_manage_product(bigint) to authenticated, anon;

alter table public.product_images enable row level security;

-- Visible exactly when the product is: the subquery runs under the caller's
-- products RLS, so a hidden, draft or suspended vendor's item hides its photos.
create policy "product images follow product visibility" on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_id));
create policy "product images owner insert" on public.product_images
  for insert to authenticated with check (public.can_manage_product(product_id));
create policy "product images owner update" on public.product_images
  for update to authenticated using (public.can_manage_product(product_id)) with check (public.can_manage_product(product_id));
create policy "product images owner delete" on public.product_images
  for delete to authenticated using (public.can_manage_product(product_id));

-- Every existing main photo becomes position 0 of its gallery.
insert into public.product_images (product_id, url, position)
select p.id, split_part(p.image_url, '?', 1), 0
from public.products p
where p.image_url ~ '^https://'
  and not exists (select 1 from public.product_images i where i.product_id = p.id);
