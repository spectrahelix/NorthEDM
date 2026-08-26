-- Promoter code at invoice checkout: the customer enters a promoter's code, gets
-- 10% off, and the promoter earns 10% of list as cash. See docs/WALLET.md.
--
-- service_quotes already carried promoter_user_id / commission_bps /
-- promoter_paid_cents (admin-attached promoter). These add the customer-entered
-- path: which code was used and how much the customer saved.

alter table public.service_quotes
  add column if not exists promoter_code  text,
  add column if not exists discount_cents int not null default 0;

-- Unused duplicate: promoters' permanent codes live on
-- festdash_promoters.referral_code, which predates this and is what the app uses.
drop table if exists public.promoter_codes;
