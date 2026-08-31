-- Store ordering: make an embedded store's products actually purchasable, plus the
-- billing gate that decides when its operator gets control. See
-- docs/FRANKS_MARKETPLACE.md.

-- ── Billing gate ────────────────────────────────────────────────────────────
-- Independent of `active` (draft/live) on purpose: `active` controls what the
-- PUBLIC sees, billing_status controls what the OPERATOR can do. CJ can publish a
-- store before its operator has paid, or keep a paid store private while reworking.
alter table public.stores
  add column if not exists billing_status text not null default 'unpaid'
    check (billing_status in ('unpaid','active','past_due','canceled')),
  add column if not exists platform_fee_bps int not null default 500,  -- NorthEDM's cut
  add column if not exists stripe_subscription_id text,
  add column if not exists setup_quote_id uuid;   -- the service_quotes invoice for setup

-- ── Orders placed on a store ────────────────────────────────────────────────
create table if not exists public.store_orders (
  id                    uuid primary key default gen_random_uuid(),
  store_id              uuid not null references public.stores(id) on delete restrict,
  customer_id           uuid references auth.users(id) on delete set null,
  email                 text,
  items                 jsonb not null default '[]',   -- [{product_id,vendor_id,name,price_cents,qty}]
  subtotal_cents        int not null default 0,
  -- Cuts are frozen at order time so what's owed is never re-derived from a
  -- setting that changed afterwards.
  platform_fee_cents    int not null default 0,
  operator_fee_cents    int not null default 0,
  total_cents           int not null default 0,
  status                text not null default 'pending',  -- pending | paid | fulfilled | canceled | refunded
  stripe_session_id     text,
  stripe_payment_intent text,
  ship_name             text,
  ship_address          jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists store_orders_store_idx on public.store_orders (store_id, created_at desc);
create index if not exists store_orders_customer_idx on public.store_orders (customer_id, created_at desc);
create unique index if not exists store_orders_session_idx
  on public.store_orders (stripe_session_id) where stripe_session_id is not null;

alter table public.store_orders enable row level security;
-- Customers read their own orders. Operators/admins read via the service role, so
-- there is deliberately NO client write policy — orders are only ever created by
-- /api/store/[slug]/checkout after it re-validates prices and stock.
drop policy if exists "customers read own store orders" on public.store_orders;
create policy "customers read own store orders" on public.store_orders
  for select using (auth.uid() = customer_id);
