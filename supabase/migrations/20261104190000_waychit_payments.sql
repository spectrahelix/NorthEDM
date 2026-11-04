-- Waychit (Gambia) payments into NorthEDM's own merchant account, and payouts
-- from it to shops, coordinators and runners. Built switched off: nothing runs
-- until WAYCHIT_API_KEY / WAYCHIT_WEBHOOK_SECRET are set AND waychit_enabled.
alter table public.coordinator_program_settings
  add column if not exists waychit_enabled boolean not null default false,
  add column if not exists waychit_fee_bps integer not null default 300 check (waychit_fee_bps between 0 and 1000);

alter table public.festdash_orders
  add column if not exists processing_fee_cents integer not null default 0,
  add column if not exists waychit_request_id text;
alter table public.store_orders
  add column if not exists processing_fee_cents integer not null default 0,
  add column if not exists waychit_request_id text;
create index if not exists festdash_orders_waychit_req on public.festdash_orders (waychit_request_id) where waychit_request_id is not null;
create index if not exists store_orders_waychit_req on public.store_orders (waychit_request_id) where waychit_request_id is not null;

-- Every webhook event once (Waychit retries for 24h and may duplicate).
create table if not exists public.waychit_events (
  id text primary key,
  type text not null,
  object_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- What NorthEDM owes out of a Waychit-collected sale, one row per recipient.
create table if not exists public.waychit_payouts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid references public.coordinator_ledger(id) on delete set null,
  order_kind text not null check (order_kind in ('festdash', 'store')),
  order_id uuid not null,
  role text not null check (role in ('shop', 'coordinator', 'runner')),
  vendor_id bigint,
  user_id uuid,
  coordinator_user_id uuid,
  channel text check (channel in ('wave', 'qmoney', 'afrimoney', 'bank')),
  destination text,
  amount_gmd integer not null check (amount_gmd >= 0),
  status text not null default 'owed' check (status in ('owed', 'sending', 'pending', 'processing', 'succeeded', 'failed', 'reversed')),
  waychit_payout_id text,
  fee_gmd integer,
  error text,
  idempotency_key text not null unique,
  sent_by uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_kind, order_id, role)
);
create index if not exists waychit_payouts_status on public.waychit_payouts (status, created_at);

alter table public.waychit_events enable row level security;
alter table public.waychit_payouts enable row level security;
revoke all on table public.waychit_events from anon, authenticated;
revoke all on table public.waychit_payouts from anon, authenticated;

-- Each send is a new attempt with its own clientReference (<row id>-<attempt>),
-- so a payout Waychit reported failed can be retried without colliding.
alter table public.waychit_payouts add column if not exists attempts integer not null default 0;
