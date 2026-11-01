-- Gambia / coordinator model, stage one (2026-11-01).
-- A regional coordinator ("purse keeper") signs up local shops, collects a flat
-- monthly fee and customers' mobile-money / cash payments, keeps a cut, pays the
-- shops, and remits the owner's share. No money moves through the site: it
-- records what moved and who confirmed it. All writes go through API routes
-- with the service role; ordinary sessions only read their own rows.

-- The purse keeper's profile lives on the promoter row.
alter table public.festdash_promoters
  add column if not exists is_coordinator boolean not null default false,
  add column if not exists region text,
  add column if not exists wave_number text,
  add column if not exists qmoney_number text,
  add column if not exists afrimoney_number text,
  add column if not exists whatsapp_number text,
  add column if not exists remitly_name text;

-- Shops a coordinator signed up. region/currency switch checkout to local
-- rails and dalasi display. The new columns are public-safe and must be granted
-- explicitly because vendors is column-granted.
alter table public.vendors
  add column if not exists coordinator_user_id uuid references auth.users(id) on delete set null,
  add column if not exists region text,
  add column if not exists currency text not null default 'USD',
  add column if not exists whatsapp_number text;
grant select (coordinator_user_id, region, currency, whatsapp_number) on table public.vendors to anon, authenticated;

-- Orders: how it was paid, where, and who confirmed it.
alter table public.festdash_orders
  add column if not exists payment_method text not null default 'card',
  add column if not exists payment_to text,
  add column if not exists payment_ref text,
  add column if not exists payment_confirmed_by uuid,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists currency text not null default 'USD';

-- Splits and the monthly fee as settings (one row), so a correction is a value
-- change rather than a deploy. Defaults: sale shop 80 / owner 10 / coordinator
-- 10; $30 fee of which the coordinator keeps 10%.
create table if not exists public.coordinator_program_settings (
  id integer primary key default 1 check (id = 1),
  sale_owner_bps integer not null default 1000,
  sale_coordinator_bps integer not null default 1000,
  subscription_fee_cents integer not null default 3000,
  subscription_coordinator_bps integer not null default 1000,
  updated_at timestamptz not null default now()
);
insert into public.coordinator_program_settings (id) values (1) on conflict (id) do nothing;
alter table public.coordinator_program_settings enable row level security;
create policy "coordinator settings public read" on public.coordinator_program_settings
  for select using (true);
revoke insert, update, delete on table public.coordinator_program_settings from anon, authenticated;

-- Monthly shop fee periods, logged by the coordinator who collected them. A shop
-- in a coordinator region is listed on FestDash only while a period is current.
create table if not exists public.vendor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id bigint not null references public.vendors(id) on delete cascade,
  coordinator_user_id uuid not null,
  period_start date not null,
  period_end date not null,
  fee_cents integer not null,
  collected_amount numeric,
  collected_currency text,
  method text not null,
  reference text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists vendor_subscriptions_vendor_idx on public.vendor_subscriptions (vendor_id, period_end desc);
alter table public.vendor_subscriptions enable row level security;
create policy "subscriptions party read" on public.vendor_subscriptions
  for select to authenticated
  using (
    coordinator_user_id = auth.uid()
    or public.is_site_admin()
    or vendor_id in (select up.vendor_id from public.user_profiles up where up.id = auth.uid() and up.vendor_id is not null)
  );
revoke insert, update, delete on table public.vendor_subscriptions from anon, authenticated;

-- The purse keeper's book: every confirmed sale's split, every fee, every send
-- to the owner (with the owner's confirmation of what landed).
create table if not exists public.coordinator_ledger (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- sale | subscription | remittance
  coordinator_user_id uuid not null,
  vendor_id bigint references public.vendors(id) on delete set null,
  order_id uuid references public.festdash_orders(id) on delete set null,
  subscription_id uuid references public.vendor_subscriptions(id) on delete set null,
  currency text not null default 'USD',
  gross_cents bigint not null default 0,
  shop_cents bigint not null default 0,
  owner_cents bigint not null default 0,
  coordinator_cents bigint not null default 0,
  method text,
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  received_usd_cents bigint,
  received_by uuid
);
create index if not exists coordinator_ledger_coord_idx on public.coordinator_ledger (coordinator_user_id, created_at desc);
create unique index if not exists coordinator_ledger_one_sale_per_order on public.coordinator_ledger (order_id) where kind = 'sale';
alter table public.coordinator_ledger enable row level security;
create policy "ledger coordinator read" on public.coordinator_ledger
  for select to authenticated
  using (coordinator_user_id = auth.uid() or public.is_site_admin());
revoke insert, update, delete on table public.coordinator_ledger from anon, authenticated;

notify pgrst, 'reload schema';
