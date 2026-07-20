-- Embedded stores: a client (operator) runs a branded multi-vendor sub-market
-- inside NorthEDM at /<slug> (e.g. /franks). See docs/FRANKS_MARKETPLACE.md.
--
-- A store groups vendors (which already exist globally). The store's owner is the
-- operator; NorthEDM admins can manage any store. operator_fee_bps is the
-- operator's cut of their vendors' sales (used by the Phase-2 payout split).

create table if not exists public.stores (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  tagline          text,
  owner_user_id    uuid not null references auth.users(id) on delete restrict,
  accent_color     text not null default '#39FF14',
  operator_fee_bps int  not null default 0,       -- operator's % of vendor sales (Phase 2)
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists stores_owner_idx on public.stores (owner_user_id);

alter table public.stores enable row level security;
drop policy if exists "public read active stores" on public.stores;
create policy "public read active stores" on public.stores for select using (active = true);

-- Which vendors sell under a store. A vendor can belong to many stores + the
-- global marketplace.
create table if not exists public.store_vendors (
  store_id  uuid   not null references public.stores(id) on delete cascade,
  vendor_id bigint not null references public.vendors(id) on delete cascade,
  status    text   not null default 'approved',   -- approved | pending
  added_at  timestamptz not null default now(),
  primary key (store_id, vendor_id)
);

alter table public.store_vendors enable row level security;
drop policy if exists "public read store vendors" on public.store_vendors;
create policy "public read store vendors" on public.store_vendors for select using (true);
