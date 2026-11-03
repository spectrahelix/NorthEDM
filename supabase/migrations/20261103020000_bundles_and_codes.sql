-- Bundle plan + discount codes (owner's model, 2026-11-03).
--  * bundle: FestDash listing + store subscription together, $45/month by
--    default (buy one, get one half off). One Stripe subscription; it counts
--    as an active listing AND flips the store on.
--  * discount_codes: % or $ off a subscription checkout. max_redemptions = 1
--    is a one-time code (first invoice only); null is unlimited (every month).
--    Promoters mint one-time codes (minted_by) for shops they bring on; the
--    owner makes codes in /admin/codes. A promoter's own referral code keeps
--    working forever and is NOT in this table.
alter table public.stripe_subscriptions drop constraint if exists stripe_subscriptions_kind_check;
alter table public.stripe_subscriptions add constraint stripe_subscriptions_kind_check check (kind in ('festdash', 'store', 'bundle'));

alter table public.coordinator_program_settings
  add column if not exists bundle_fee_cents integer not null default 4500,
  add column if not exists mint_max_percent_off integer not null default 50,
  add column if not exists mint_max_amount_off_cents integer not null default 2000;

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off integer check (percent_off between 1 and 100),
  amount_off_cents integer check (amount_off_cents > 0),
  max_redemptions integer,                 -- 1 = one-time; null = unlimited
  times_redeemed integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  minted_by uuid,                          -- promoter who minted it; null = owner
  note text,
  last_redeemed_by uuid,
  last_redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  check (percent_off is not null or amount_off_cents is not null)
);
alter table public.discount_codes enable row level security;
create policy "discount_codes minter read" on public.discount_codes
  for select to authenticated using (minted_by = auth.uid());

alter table public.vendors add column if not exists signup_code text;
alter table public.festdash_promoter_applications
  add column if not exists invite_code text,
  add column if not exists invited_by uuid;
alter table public.festdash_promoters add column if not exists invited_by uuid;
