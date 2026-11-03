-- Shipping + product specifications (2026-11-03). One calculator, one set of
-- documents (invoice, receipt, label) for every shop: NorthEDM's own shop
-- (shop_products / shop_orders) and vendor stores (products / store_orders).
alter table public.products
  add column if not exists weight_g integer,
  add column if not exists length_cm numeric,
  add column if not exists width_cm numeric,
  add column if not exists height_cm numeric,
  add column if not exists hs_code text,
  add column if not exists origin_country text not null default 'US',
  add column if not exists specs jsonb not null default '{}'::jsonb;
alter table public.shop_products
  add column if not exists weight_g integer,
  add column if not exists length_cm numeric,
  add column if not exists width_cm numeric,
  add column if not exists height_cm numeric,
  add column if not exists hs_code text,
  add column if not exists origin_country text not null default 'US',
  add column if not exists specs jsonb not null default '{}'::jsonb;
alter table public.shop_orders
  add column if not exists ship_country text,
  add column if not exists shipping_zone text,
  add column if not exists shipping_service text,
  add column if not exists shipping_eta text,
  add column if not exists package_weight_g integer,
  add column if not exists tracking_number text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists paid_at timestamptz;
alter table public.store_orders
  add column if not exists shipping_cents integer not null default 0,
  add column if not exists ship_country text,
  add column if not exists shipping_zone text,
  add column if not exists shipping_service text,
  add column if not exists shipping_eta text,
  add column if not exists package_weight_g integer,
  add column if not exists tracking_number text,
  add column if not exists paid_at timestamptz;
alter table public.stores add column if not exists ship_from jsonb;
create table if not exists public.shipping_settings (
  id integer primary key default 1 check (id = 1),
  ship_from jsonb,
  handling_cents integer not null default 0,
  rates jsonb,
  updated_at timestamptz not null default now()
);
insert into public.shipping_settings (id) values (1) on conflict (id) do nothing;
alter table public.shipping_settings enable row level security;
create policy "shipping settings public read" on public.shipping_settings for select using (true);
revoke insert, update, delete on table public.shipping_settings from anon, authenticated;
grant select (weight_g, length_cm, width_cm, height_cm, hs_code, origin_country, specs) on public.products to anon, authenticated;
grant select (weight_g, length_cm, width_cm, height_cm, hs_code, origin_country, specs) on public.shop_products to anon, authenticated;
