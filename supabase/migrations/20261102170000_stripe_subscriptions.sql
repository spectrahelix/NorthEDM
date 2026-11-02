-- Monthly subscriptions paid by card through Stripe: the US FestDash listing fee
-- and the embedded-store fee ($30/month each by default; a referral code takes
-- 10% off and the referring promoter earns 10% of each payment). Written only by
-- the server (checkout creation + Stripe webhook); no end-user policies.
create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('festdash', 'store')),
  vendor_id bigint references public.vendors(id),
  store_id uuid,
  user_id uuid,
  promoter_user_id uuid,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  amount_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stripe_subscriptions_vendor_idx on public.stripe_subscriptions (vendor_id, kind);
create index if not exists stripe_subscriptions_store_idx on public.stripe_subscriptions (store_id, kind);
alter table public.stripe_subscriptions enable row level security;
alter table public.coordinator_program_settings
  add column if not exists referral_fee_discount_bps integer not null default 1000;
