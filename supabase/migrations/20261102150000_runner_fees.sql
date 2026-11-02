-- Runner fee: chosen by the customer at checkout (10% of items minimum), paid
-- in full to the runner at the delivery code (Stripe transfer on the card rail;
-- a ledger line the coordinator pays out on the wallet rail).
alter table public.festdash_orders
  add column if not exists runner_fee_cents integer not null default 0,
  add column if not exists runner_fee_transfer_id text,
  add column if not exists runner_fee_paid_at timestamptz;
alter table public.festdash_drivers
  add column if not exists stripe_account_id text;
alter table public.coordinator_ledger
  add column if not exists runner_cents integer not null default 0;
