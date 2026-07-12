-- Square inventory sync (Phase 1) — one-way Square → NorthEDM.
--
-- A vendor connects their Square (sandbox or production) with an access token +
-- location. A sync pulls their Square catalog + inventory and mirrors it into
-- `products` (one product per Square item variation). Square is the source of
-- truth; synced products are read-only in NorthEDM. Payments stay on Stripe —
-- this is inventory only.

create table if not exists public.vendor_square_connections (
  vendor_id        bigint primary key references public.vendors(id) on delete cascade,
  access_token     text not null,
  location_id      text not null,
  environment      text not null default 'sandbox',   -- 'sandbox' | 'production'
  last_synced_at   timestamptz,
  last_sync_status text,
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Access tokens are secrets. Lock the table to the service role only: RLS on
-- with no policies denies anon/authenticated entirely; the vendor Square API
-- routes reach it through the service-role client. The token is never returned
-- to the browser (status endpoint omits it).
alter table public.vendor_square_connections enable row level security;

-- Mark Square-sourced products so they upsert idempotently and render read-only.
alter table public.products
  add column if not exists source              text not null default 'manual', -- 'manual' | 'square'
  add column if not exists square_catalog_id   text,
  add column if not exists square_variation_id text,
  add column if not exists synced_at           timestamptz;

-- One NorthEDM product per (vendor, Square variation) — guards against dupes.
create unique index if not exists products_vendor_square_variation_uidx
  on public.products (vendor_id, square_variation_id)
  where square_variation_id is not null;
