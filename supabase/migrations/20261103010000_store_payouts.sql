-- Embedded-store payouts. A card store order is charged to NorthEDM's Stripe;
-- each selling vendor's share (and the operator's cut, if the store has one) is
-- transferred to their Connect account when the order is paid. A vendor with no
-- account yet gets an 'owed' row the commissions cron pays once they connect.
-- Wallet-rail (non-USD) store orders never come here: their split lives on
-- coordinator_ledger.
alter table public.vendors add column if not exists stripe_account_id text;

create table if not exists public.store_payouts (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders(id) on delete cascade,
  vendor_id bigint not null references public.vendors(id) on delete cascade,
  kind text not null default 'vendor',          -- vendor | operator
  amount_cents bigint not null,
  currency text not null default 'USD',
  stripe_account_id text,
  stripe_transfer_id text,
  status text not null default 'owed',          -- owed | paid | reversed | failed
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  reversed_at timestamptz
);
create unique index if not exists store_payouts_one_per_payee on public.store_payouts (store_order_id, vendor_id, kind);
create index if not exists store_payouts_owed_idx on public.store_payouts (status) where status = 'owed';
alter table public.store_payouts enable row level security;
-- The vendor sees their own rows; everything else is service role.
create policy "store_payouts vendor read" on public.store_payouts
  for select to authenticated
  using (vendor_id = (select vendor_id from public.user_profiles where id = auth.uid()));
