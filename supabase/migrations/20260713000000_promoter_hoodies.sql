-- Promoter Hoodies (Bright Future collab).
--
-- Each physical hoodie has a unique code woven into its QR. Scanning opens
-- /h/<code>, which attributes the shopper to that hoodie's promoter and applies
-- the promoter's discount at shop checkout. What the customer saves is credited
-- to the promoter as store credit. One row = one hoodie.

create table if not exists public.promoter_hoodies (
  id               uuid primary key default gen_random_uuid(),
  promoter_user_id uuid not null references auth.users(id) on delete cascade,
  code             text not null unique,               -- encoded in the woven QR
  label            text,                                 -- e.g. "Hoodie #001 · L · Black"
  percent_off      int  not null default 10,             -- customer discount = promoter earning
  active           boolean not null default true,
  scans            int  not null default 0,
  redemptions      int  not null default 0,
  earned_cents     int  not null default 0,              -- total credited to the promoter
  created_at       timestamptz not null default now()
);

create index if not exists promoter_hoodies_promoter_idx
  on public.promoter_hoodies (promoter_user_id);

-- Service-role only: minting (admin), the scan landing, and checkout/webhook
-- crediting all go through the service-role client. No public row access — the
-- table carries per-promoter earnings that shouldn't be enumerable.
alter table public.promoter_hoodies enable row level security;

-- shop_orders: record which hoodie/promoter drove the order and the discount given.
alter table public.shop_orders
  add column if not exists hoodie_code       text,
  add column if not exists promoter_user_id  uuid,
  add column if not exists discount_cents    int not null default 0;
